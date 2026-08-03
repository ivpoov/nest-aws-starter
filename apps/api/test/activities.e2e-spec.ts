import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('admin activities', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let userToken: string;
  let targetEmail: string;
  let targetUserId: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(
    displayName: string,
  ): Promise<{ email: string; accessToken: string }> {
    const email: string = `activity-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, accessToken: response.body.accessToken };
  }

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await registerUser('Activity Admin E2E');
    const target = await registerUser('Activity Target E2E');

    targetEmail = target.email;
    userToken = target.accessToken;

    // promote directly in the database — there is deliberately no promote endpoint
    await app.get(PrismaService).user.updateMany({
      where: { authMethods: { some: { email: admin.email } } },
      data: { role: 'ADMIN' },
    });

    // re-login so the access token carries the ADMIN role claim (auth.login)
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: admin.email, password: 'correct-horse-battery' })
      .expect(200);

    adminToken = login.body.accessToken;

    // three failed login attempts for the target (auth.login-failed x3)
    for (let attempt = 0; attempt < 3; attempt++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-forwarded-for', uniqueIp())
        .send({ email: targetEmail, password: 'wrong-password' })
        .expect(401);
    }

    // one successful login for the target (auth.login) — its token stays
    // live and is what non-admin checks use below
    const relogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: targetEmail, password: 'correct-horse-battery' })
      .expect(200);

    // logout on the original registration session (auth.logout)
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('authorization', `Bearer ${userToken}`)
      .expect(204);

    userToken = relogin.body.accessToken;

    const found = await app
      .get(PrismaService)
      .authMethod.findFirst({ where: { email: targetEmail } });

    targetUserId = found?.userId ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/activities').expect(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/activities')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('filters by userId and pages by cursor', async () => {
    // Scoping by userId isolates this from other e2e suites running
    // concurrently against the same database — a randomUUID-derived user
    // never collides, unlike a plain type filter which any suite can pollute.
    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/activities?userId=${targetUserId}&limit=2`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).toBeTruthy();
    for (const item of firstPage.body.items) {
      expect(item.userId).toBe(targetUserId);
    }

    const secondPage = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/activities?userId=${targetUserId}&limit=2&cursor=${firstPage.body.nextCursor}`,
      )
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.nextCursor).toBeNull();

    const allTypes: string[] = [...firstPage.body.items, ...secondPage.body.items].map(
      (item: { type: string }) => item.type,
    );

    expect(allTypes).toEqual(
      expect.arrayContaining(['USER_REGISTERED', 'AUTH_LOGIN', 'AUTH_LOGOUT']),
    );
  });

  it('filters by type, exposing the failed-login meta', async () => {
    const filtered = await request(app.getHttpServer())
      .get('/api/v1/admin/activities?type=AUTH_LOGIN_FAILED&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matching = filtered.body.items.filter(
      (item: { meta: { email: string } }) => item.meta.email === targetEmail,
    );

    expect(matching.length).toBeGreaterThanOrEqual(3);
    for (const item of filtered.body.items) {
      expect(item.type).toBe('AUTH_LOGIN_FAILED');
    }
  });

  it('returns only the given user activities through the nested endpoint', async () => {
    const nested = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${targetUserId}/activities`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(nested.body.items.length).toBeGreaterThanOrEqual(3);
    for (const item of nested.body.items) {
      expect(item.userId).toBe(targetUserId);
    }
  });

  it('returns 404 for an unknown user id on the nested endpoint', async () => {
    const missing = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${randomUUID()}/activities`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(missing.body.code).toBe('USER_NOT_FOUND');
  });

  it('filters by date range', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();

    const empty = await request(app.getHttpServer())
      .get(`/api/v1/admin/activities?userId=${targetUserId}&dateFrom=${future}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(empty.body.items).toHaveLength(0);

    const past = new Date(Date.now() - 60_000).toISOString();

    const nonEmpty = await request(app.getHttpServer())
      .get(`/api/v1/admin/activities?userId=${targetUserId}&dateFrom=${past}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(nonEmpty.body.items.length).toBeGreaterThan(0);
  });
});
