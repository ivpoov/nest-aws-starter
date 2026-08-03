import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('admin login-as', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let adminId: string;
  let admin2Id: string;
  let userToken: string;
  let targetId: string;
  let targetDisplayName: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(displayName: string): Promise<{
    email: string;
    userId: string;
    accessToken: string;
  }> {
    const email: string = `login-as-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    const found = await app.get(PrismaService).authMethod.findFirst({ where: { email } });

    return { email, userId: found?.userId ?? '', accessToken: response.body.accessToken };
  }

  async function promoteToAdmin(email: string): Promise<string> {
    await app
      .get(PrismaService)
      .user.updateMany({ where: { authMethods: { some: { email } } }, data: { role: 'ADMIN' } });

    // re-login so the access token carries the ADMIN role claim
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email, password: 'correct-horse-battery' })
      .expect(200);

    return login.body.accessToken as string;
  }

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await registerUser('Login-As Admin E2E');
    const admin2 = await registerUser('Login-As Admin2 E2E');
    const target = await registerUser('Login-As Target E2E');

    adminId = admin.userId;
    admin2Id = admin2.userId;
    targetId = target.userId;
    userToken = target.accessToken;
    targetDisplayName = 'Login-As Target E2E';

    adminToken = await promoteToAdmin(admin.email);
    await promoteToAdmin(admin2.email);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a non-admin caller', async () => {
    const forbidden = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetId}/login-as`)
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('returns 404 for an unknown target', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${randomUUID()}/login-as`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('refuses to impersonate an admin target', async () => {
    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${admin2Id}/login-as`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(rejected.body.code).toBe('ADMIN_CANNOT_IMPERSONATE_ADMIN');
  });

  it('mints a working impersonated session, flagged everywhere, denied on /admin/*', async () => {
    const loginAs = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetId}/login-as`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(201);

    expect(loginAs.body.code).toBeTruthy();
    expect(loginAs.body.accessToken).toBeUndefined();

    // The admin UI never sees tokens directly — it opens the web app with
    // this one-time code, which redeems it through the same public
    // exchange endpoint OAuth login already uses.
    const exchanged = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: loginAs.body.code })
      .expect(200);

    expect(exchanged.body.kind).toBe('LOGIN');
    expect(exchanged.body.tokens.accessToken).toBeTruthy();
    expect(exchanged.body.tokens.refreshToken).toBeTruthy();

    // Single-use: the same code cannot be redeemed twice.
    const reused = await request(app.getHttpServer())
      .post('/api/v1/auth/oauth/exchange')
      .send({ code: loginAs.body.code })
      .expect(401);

    expect(reused.body.code).toBe('OAUTH_EXCHANGE_CODE_INVALID');

    const impersonatedToken: string = exchanged.body.tokens.accessToken;
    const impersonatedRefreshToken: string = exchanged.body.tokens.refreshToken;

    // The token works as a normal session for the TARGET user.
    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${impersonatedToken}`)
      .expect(200);

    expect(me.body.displayName).toBe(targetDisplayName);

    // Both sessions UIs flag it.
    const sessions = await request(app.getHttpServer())
      .get('/api/v1/sessions')
      .set('authorization', `Bearer ${impersonatedToken}`)
      .expect(200);
    const current = sessions.body.find((session: { isCurrent: boolean }) => session.isCurrent);

    expect(current.isImpersonated).toBe(true);

    const adminSessions = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${targetId}/sessions`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(
      adminSessions.body.some((session: { isImpersonated: boolean }) => session.isImpersonated),
    ).toBe(true);

    // Defense in depth: an impersonated ADMIN cannot reach /admin/* at all —
    // no privilege re-escalation, no login-as nesting either.
    const deniedList = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${impersonatedToken}`)
      .expect(403);

    expect(deniedList.body.code).toBe('ADMIN_IMPERSONATION_FORBIDDEN');

    const deniedNesting = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${targetId}/login-as`)
      .set('authorization', `Bearer ${impersonatedToken}`)
      .expect(403);

    expect(deniedNesting.body.code).toBe('ADMIN_IMPERSONATION_FORBIDDEN');

    // Refresh re-derives the flag from the session row, not the old token.
    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: impersonatedRefreshToken })
      .expect(200);

    const deniedAfterRefresh = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(403);

    expect(deniedAfterRefresh.body.code).toBe('ADMIN_IMPERSONATION_FORBIDDEN');
  });

  it('records ADMIN_LOGIN_AS in the activity log with the admin as actor', async () => {
    const activities = await request(app.getHttpServer())
      .get(`/api/v1/admin/activities?userId=${targetId}&type=ADMIN_LOGIN_AS&limit=10`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(activities.body.items.length).toBeGreaterThanOrEqual(1);
    for (const item of activities.body.items) {
      expect(item.type).toBe('ADMIN_LOGIN_AS');
      expect(item.actorId).toBe(adminId);
      expect(item.userId).toBe(targetId);
    }
  });
});
