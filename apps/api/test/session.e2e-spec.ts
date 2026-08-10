import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { SESSION_REPOSITORY } from '@modules/session/constants/session.constants.js';
import type { SessionRepositoryInterface } from '@modules/session/interfaces/session-repository.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('sessions and the global auth guard', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .set('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/141.0')
      .send({
        displayName: 'Session E2E',
        email: `session-e2e-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    return response.body;
  }

  it('rejects guarded routes without a token', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/sessions').expect(401);

    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('lists sessions with the current one flagged and parsed device info', async () => {
    const tokens = await registerUser();

    const response = await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].isCurrent).toBe(true);
    expect(response.body[0].device).toContain('Firefox');
    expect(Object.keys(response.body[0]).sort()).toEqual([
      'createdAt',
      'device',
      'id',
      'ip',
      'isCurrent',
      'isImpersonated',
      'lastActiveAt',
    ]);
    expect(response.body[0].isImpersonated).toBe(false);
  });

  it('logout revokes the access token instantly via the allowlist', async () => {
    const tokens = await registerUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(204);

    const afterLogout = await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(401);

    expect(afterLogout.body.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('revokes all other sessions but keeps the current one alive', async () => {
    const email: string = `session-e2e-${randomUUID()}@example.com`;

    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Multi', email, password: 'correct-horse-battery' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'correct-horse-battery' })
      .expect(200);

    const revoked = await request(app.getHttpServer())
      .delete('/api/v1/sessions')
      .set('authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);

    expect(revoked.body.revokedCount).toBe(1);

    await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
  });

  // The fail-safe-ordering proof for revocation (conventions §7a), against real
  // Redis and real Postgres. Revocation spans two stores, so no transaction can
  // cover it and ordering is the whole design — but a happy-path logout passes
  // under either order. This induces a real failure BETWEEN the two writes,
  // after the row write has genuinely committed, and asserts the access token is
  // already dead.
  //
  // With the writes in the old order the row write goes first, so the induced
  // failure skips the allowlist delete entirely and this test sees the fail-open
  // state it exists to forbid: the row and both sessions UIs say "revoked" while
  // the access token keeps working for its full TTL. verifyAccessToken authorizes
  // on allowlist membership alone and never reads activeUntil, which is exactly
  // why the Redis delete has to be the write that goes first.
  it('revocation is fail-safe: an induced failure mid-operation kills the token even when the row write commits', async () => {
    const tokens = await registerUser();
    const listed = await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
    const sessionId: string = listed.body[0].id;
    const prisma: PrismaService = app.get(PrismaService);
    const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    const repository: SessionRepositoryInterface =
      app.get<SessionRepositoryInterface>(SESSION_REPOSITORY);
    const realSetActiveUntil = repository.setActiveUntil.bind(repository);
    const spy = vi
      .spyOn(repository, 'setActiveUntil')
      .mockImplementation(async (id: string, activeUntil: Date): Promise<boolean> => {
        // Let the bookkeeping write really commit, THEN die. Only a genuine
        // allowlist-first ordering can satisfy the assertion below.
        await realSetActiveUntil(id, activeUntil);

        throw new Error('induced failure mid-revocation');
      });

    await expect(app.get(SessionService).revokeSession(row.userId, sessionId)).rejects.toThrow(
      'induced failure mid-revocation',
    );

    spy.mockRestore();

    // The only assertion that matters: access is gone. The row is committed as
    // revoked too, so nothing here is stale — but had the row write failed
    // instead, "row still active, token dead" is the safe direction.
    const afterFailure = await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(401);

    expect(afterFailure.body.code).toBe('AUTH_TOKEN_INVALID');

    // The refresh token died with it, so the failure cannot be traded back into
    // a fresh pair.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('x-forwarded-for', uniqueIp())
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
  });
});
