import { randomUUID } from 'node:crypto';
import { UserStatus } from '@generated/prisma/enums.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

// The allowlist keys are per user and per session, and both ids live in the
// access token's claims — reading them here beats guessing at a SCAN pattern.
function decodeJwtPayload(token: string): { sub: string; sessionId: string } {
  const segment: string = token.split('.')[1] ?? '';

  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

describe('auth (email + password)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueEmail(): string {
    return `auth-e2e-${randomUUID()}@example.com`;
  }

  // TRUST_PROXY=true in test env: a unique client ip per call keeps the strict
  // per-ip auth budgets (register 3/min, login 5/min) out of the way.
  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function register(email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'E2E Auth', email, password: 'correct-horse-battery' })
      .expect(201);

    return response.body;
  }

  it('registers and returns a token pair', async () => {
    const tokens = await register(uniqueEmail());

    expect(tokens.accessToken).toMatch(/^eyJ/);
    expect(tokens.refreshToken).toMatch(/^eyJ/);
    expect(Object.keys(tokens).sort()).toEqual(['accessToken', 'expiresInSec', 'refreshToken']);
  });

  it('rejects a duplicate email with the coded conflict', async () => {
    const email: string = uniqueEmail();

    await register(email);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Again', email, password: 'correct-horse-battery' })
      .expect(409);

    expect(response.body.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('rejects registration when the email belongs to an oauth-only account with meta.providers', async () => {
    const email: string = uniqueEmail();
    const users: UserService = app.get(UserService);

    await users.createWithOauthMethod({
      displayName: 'OAuth Born',
      type: AuthMethodTypeEnum.GOOGLE,
      providerAccountId: `google-${randomUUID()}`,
      email,
      isEmailVerified: true,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Clash', email, password: 'correct-horse-battery' })
      .expect(409);

    expect(response.body.code).toBe('AUTH_EMAIL_LINKED_TO_PROVIDER');
    expect(response.body.meta).toEqual({ providers: ['GOOGLE'] });
  });

  it('logs in with valid credentials and rejects a wrong password', async () => {
    const email: string = uniqueEmail();

    await register(email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'correct-horse-battery' })
      .expect(200);

    const failed = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'wrong-password-entirely' })
      .expect(401);

    expect(failed.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('does not reveal whether an email exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: uniqueEmail(), password: 'whatever-password' })
      .expect(401);

    expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('refuses login for a blocked user with the coded error', async () => {
    const email: string = uniqueEmail();

    await register(email);

    const prisma: PrismaService = app.get(PrismaService);

    await prisma.user.updateMany({
      where: { authMethods: { some: { email } } },
      data: { status: UserStatus.BLOCKED },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'correct-horse-battery' })
      .expect(403);

    expect(response.body.code).toBe('USER_BLOCKED');
  });

  it('rotates the refresh token and replays idempotently inside the grace window', async () => {
    const first = await register(uniqueEmail());

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    expect(rotated.body.refreshToken).not.toBe(first.refreshToken);

    const replayed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    expect(replayed.body.refreshToken).toBe(rotated.body.refreshToken);
  });

  // The schema promises no token material lives in Postgres. It never did —
  // it all lived in Redis instead, verbatim, for the whole 26-day refresh
  // TTL, which is to say every live session's refresh token was sitting there
  // directly replayable by anything that could read the store.
  it('keeps no replayable token material in the Redis allowlist', async () => {
    const tokens = await register(uniqueEmail());
    const redis = app.get<RedisClientType>(REDIS_CLIENT);
    const claims: { sub: string; sessionId: string } = decodeJwtPayload(tokens.accessToken);

    const storedRefresh: string | null = await redis.get(
      `users:${claims.sub}:sessions:${claims.sessionId}:refresh`,
    );
    const storedAccess: string | null = await redis.get(
      `users:${claims.sub}:sessions:${claims.sessionId}:access`,
    );

    expect(storedRefresh).not.toBeNull();
    expect(storedRefresh).not.toBe(tokens.refreshToken);
    expect(storedRefresh).toMatch(/^[0-9a-f]{64}$/);
    expect(storedAccess).not.toBe(tokens.accessToken);
    expect(storedAccess).toMatch(/^[0-9a-f]{64}$/);

    // Still a working allowlist, not just an opaque blob: the access token it
    // was minted with is accepted, and revocation still bites.
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);

    await redis.del(`users:${claims.sub}:sessions:${claims.sessionId}:access`);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(401);
  });

  // Deploy compatibility, against a real Redis rather than a fake: keys
  // written by the previous release hold the token verbatim. They have to keep
  // working once — otherwise shipping this signs every logged-in user out —
  // and be rewritten as a digest with their remaining TTL intact.
  // Asserted on the access key rather than the refresh key: a refresh would
  // rotate and overwrite the value anyway, so it could not tell an upgrade
  // apart from a fresh write. Reading /users/me only ever compares.
  it('accepts a pre-digest allowlist key once and upgrades it in place', async () => {
    const tokens = await register(uniqueEmail());
    const redis = app.get<RedisClientType>(REDIS_CLIENT);
    const claims: { sub: string; sessionId: string } = decodeJwtPayload(tokens.accessToken);
    const accessKey = `users:${claims.sub}:sessions:${claims.sessionId}:access`;

    // Put the key back the way the previous release wrote it.
    await redis.set(accessKey, tokens.accessToken, 'EX', 900);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);

    expect(await redis.get(accessKey)).toMatch(/^[0-9a-f]{64}$/);
    // KEEPTTL: the upgrade must not resurrect an expiring session.
    expect(await redis.ttl(accessKey)).toBeGreaterThan(0);
    expect(await redis.ttl(accessKey)).toBeLessThanOrEqual(900);

    // And still a working credential after the rewrite.
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
  });

  // The stolen-token tripwire: a signed refresh token matching neither the
  // current allowlist entry nor the grace window means reuse, and takes the
  // whole session down. Digesting the allowlist must not blunt it.
  it('revokes the session when a superseded refresh token is presented after the grace window', async () => {
    const first = await register(uniqueEmail());
    const redis = app.get<RedisClientType>(REDIS_CLIENT);
    const claims: { sub: string; sessionId: string } = decodeJwtPayload(first.accessToken);

    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    // Close the grace window rather than waiting it out.
    await redis.del(`users:${claims.sub}:sessions:${claims.sessionId}:refresh:prev`);

    const reused = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    expect(reused.body.code).toBe('AUTH_REFRESH_INVALID');

    // The tripwire revoked the session, so the rotated token is dead too.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('rejects a garbage refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);

    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
  });
});
