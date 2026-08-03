import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
      'lastActiveAt',
    ]);
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
});
