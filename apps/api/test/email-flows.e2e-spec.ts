import { randomUUID } from 'node:crypto';
import { UserService } from '@modules/user/services/user.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('email flows', () => {
  let app: NestFastifyApplication;
  let redis: RedisClientType;

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get<RedisClientType>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(): Promise<{
    email: string;
    userId: string;
    accessToken: string;
  }> {
    const email: string = `flows-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName: 'Flows E2E', email, password: 'correct-horse-battery' })
      .expect(201);
    const found = await app.get(UserService).findByAuthEmail(email);

    return { email, userId: found?.id ?? '', accessToken: response.body.accessToken };
  }

  it('verifies an email end to end and burns the token on use', async () => {
    const { email, userId, accessToken } = await registerUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify-request')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(204);

    const token: string | null = await redis.get(`users:${userId}:verify-email`);

    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ userId, token })
      .expect(204);

    const method = await app.get(UserService).findEmailMethod(email);

    expect(method?.isEmailVerified).toBe(true);

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ userId, token })
      .expect(401);

    expect(replay.body.code).toBe('AUTH_ONE_TIME_TOKEN_INVALID');
  });

  it('always answers 204 on forgot-password, even for unknown emails', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: `nobody-${randomUUID()}@example.com` })
      .expect(204);
  });

  it('resets the password and revokes every session', async () => {
    const { email, userId, accessToken } = await registerUser();

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/forgot')
      .set('x-forwarded-for', uniqueIp())
      .send({ email })
      .expect(204);

    const token: string | null = await redis.get(`users:${userId}:reset-password`);

    expect(token).toBeTruthy();

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .set('x-forwarded-for', uniqueIp())
      .send({ userId, token, password: 'brand-new-password-1' })
      .expect(204);

    // every session died with the reset
    await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(401);

    // old password dead, new one works
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'correct-horse-battery' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'brand-new-password-1' })
      .expect(200);
  });

  it('rejects a reset with a wrong token', async () => {
    const { userId } = await registerUser();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset')
      .set('x-forwarded-for', uniqueIp())
      .send({ userId, token: 'forged-token-value', password: 'whatever-password-1' })
      .expect(401);

    expect(response.body.code).toBe('AUTH_ONE_TIME_TOKEN_INVALID');
  });

  it('changes the password with the current one and keeps the current session alive', async () => {
    const { email, accessToken } = await registerUser();

    const wrongCurrent = await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'not-the-password', password: 'next-password-1' })
      .expect(401);

    expect(wrongCurrent.body.code).toBe('AUTH_INVALID_CREDENTIALS');

    await request(app.getHttpServer())
      .post('/api/v1/auth/password/change')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'correct-horse-battery', password: 'next-password-1' })
      .expect(204);

    // current session survives a change (unlike a reset)
    await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'next-password-1' })
      .expect(200);
  });
});
