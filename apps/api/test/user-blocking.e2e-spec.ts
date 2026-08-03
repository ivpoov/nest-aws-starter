import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('admin user blocking', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let adminId: string;
  let userEmail: string;
  let userPassword: string;
  let userToken: string;
  let userRefreshToken: string;
  let userId: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(displayName: string): Promise<{
    email: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const email: string = `block-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    return {
      email,
      accessToken: response.body.accessToken,
      refreshToken: response.body.refreshToken,
    };
  }

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await registerUser('Block Admin E2E');
    const target = await registerUser('Block Target E2E');

    userEmail = target.email;
    userPassword = 'correct-horse-battery';
    userToken = target.accessToken;
    userRefreshToken = target.refreshToken;

    // promote directly in the database — there is deliberately no promote endpoint
    await app.get(PrismaService).user.updateMany({
      where: { authMethods: { some: { email: admin.email } } },
      data: { role: 'ADMIN' },
    });

    // re-login so the access token carries the ADMIN role claim
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: admin.email, password: 'correct-horse-battery' })
      .expect(200);

    adminToken = login.body.accessToken;

    const foundAdmin = await app
      .get(PrismaService)
      .authMethod.findFirst({ where: { email: admin.email } });
    const foundUser = await app
      .get(PrismaService)
      .authMethod.findFirst({ where: { email: userEmail } });

    adminId = foundAdmin?.userId ?? '';
    userId = foundUser?.userId ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${userId}/status`)
      .send({ status: 'BLOCKED' })
      .expect(401);

    const forbidden = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set('authorization', `Bearer ${userToken}`)
      .send({ status: 'BLOCKED' })
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('rejects an admin blocking their own account', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${adminId}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'BLOCKED' })
      .expect(409);

    expect(response.body.code).toBe('USER_CANNOT_BLOCK_SELF');
  });

  it('blocks a user, revokes sessions instantly, and rejects further login', async () => {
    // the target is currently authenticated
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${userToken}`)
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'BLOCKED' })
      .expect(200);

    expect(blocked.body.status).toBe('BLOCKED');

    // allowlist keys are gone: the live access token dies instantly
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${userToken}`)
      .expect(401);

    // refresh dies instantly too
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('x-forwarded-for', uniqueIp())
      .send({ refreshToken: userRefreshToken })
      .expect(401);

    // login rejects with the coded 403
    const loginBlocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: userEmail, password: userPassword })
      .expect(403);

    expect(loginBlocked.body.code).toBe('USER_BLOCKED');
  });

  it('records a USER_BLOCKED activity row', async () => {
    const activities = await request(app.getHttpServer())
      .get(`/api/v1/admin/activities?type=USER_BLOCKED&userId=${userId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(activities.body.items.length).toBeGreaterThanOrEqual(1);
    expect(activities.body.items[0].userId).toBe(userId);
    expect(activities.body.items[0].actorId).toBe(adminId);
  });

  it('unblocks a user and restores login', async () => {
    const unblocked = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    expect(unblocked.body.status).toBe('ACTIVE');

    const loginRestored = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: userEmail, password: userPassword })
      .expect(200);

    expect(loginRestored.body.accessToken).toBeTruthy();
  });

  it('records a USER_UNBLOCKED activity row', async () => {
    const activities = await request(app.getHttpServer())
      .get(`/api/v1/admin/activities?type=USER_UNBLOCKED&userId=${userId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(activities.body.items.length).toBeGreaterThanOrEqual(1);
    expect(activities.body.items[0].userId).toBe(userId);
    expect(activities.body.items[0].actorId).toBe(adminId);
  });

  it('returns 404 for an unknown user id', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${randomUUID()}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'BLOCKED' })
      .expect(404);
  });

  it('returns 400 for an invalid status value', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${userId}/status`)
      .set('authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_A_STATUS' })
      .expect(400);

    expect(response.body.code).toBeTruthy();
  });
});
