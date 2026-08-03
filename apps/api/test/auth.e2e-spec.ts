import { randomUUID } from 'node:crypto';
import { UserStatus } from '@generated/prisma/enums.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

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

  async function register(email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
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
      .send({ email, password: 'correct-horse-battery' })
      .expect(200);

    const failed = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-entirely' })
      .expect(401);

    expect(failed.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('does not reveal whether an email exists', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
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

  it('rejects a garbage refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);

    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
  });
});
