import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('admin users', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let userToken: string;
  let userRefreshToken: string;
  let userEmail: string;
  let userId: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(displayName: string): Promise<{
    email: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const email: string = `admin-e2e-${randomUUID()}@example.com`;
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

    const admin = await registerUser('Admin E2E');
    const target = await registerUser('Target E2E');

    userEmail = target.email;
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

    const found = await app
      .get(PrismaService)
      .authMethod.findFirst({ where: { email: userEmail } });

    userId = found?.userId ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('lists users with cursor pagination and finds them by email search', async () => {
    const page = await request(app.getHttpServer())
      .get('/api/v1/admin/users?limit=2')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(page.body.items).toHaveLength(2);
    expect(page.body.nextCursor).toBeTruthy();

    const searched = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?search=${encodeURIComponent(userEmail)}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(searched.body.items).toHaveLength(1);
    expect(searched.body.items[0].email).toBe(userEmail);
    expect(searched.body.items[0].methodTypes).toEqual(['EMAIL']);
    expect(searched.body.items[0].passwordHash).toBeUndefined();
  });

  // Paging used Prisma's `cursor` + `skip: 1`, which offsets past exactly one
  // row on the assumption that the cursor row is still the first row the query
  // matches. `search` matches on mutable columns: the moment the cursor user is
  // renamed, the search has already excluded them and the offset ate the next
  // legitimate user instead — silently, and only for searched lists.
  it('keeps the user after a cursor whose own row stopped matching the search', async () => {
    const marker: string = `Keyset${randomUUID().replace(/-/g, '')}`;
    const prisma: PrismaService = app.get(PrismaService);

    await registerUser(`${marker} oldest`);
    const middle = await registerUser(`${marker} middle`);
    const newest = await registerUser(`${marker} newest`);

    const middleId: string =
      (await prisma.authMethod.findFirst({ where: { email: middle.email } }))?.userId ?? '';
    const newestId: string =
      (await prisma.authMethod.findFirst({ where: { email: newest.email } }))?.userId ?? '';

    const firstPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?search=${marker}&limit=1`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(firstPage.body.items[0].id).toBe(newestId);
    expect(firstPage.body.nextCursor).toBe(newestId);

    // The cursor row leaves the searched set between the two requests.
    await prisma.user.update({ where: { id: newestId }, data: { displayName: 'Renamed Away' } });

    const secondPage = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?search=${marker}&limit=1&cursor=${newestId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(secondPage.body.items[0].id).toBe(middleId);
  });

  it('returns the user detail and its sessions', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${userId}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(detail.body.displayName).toBe('Target E2E');

    const sessions = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${userId}/sessions`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(sessions.body.length).toBeGreaterThanOrEqual(1);
    expect(sessions.body[0].id).toBeTruthy();
  });

  it('force logout kills access and refresh instantly', async () => {
    // the target is currently authenticated
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${userToken}`)
      .expect(200);

    const revoked = await request(app.getHttpServer())
      .delete(`/api/v1/admin/users/${userId}/sessions`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(revoked.body.revokedCount).toBeGreaterThanOrEqual(1);

    // allowlist keys are gone: both tokens die immediately
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${userToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('x-forwarded-for', uniqueIp())
      .send({ refreshToken: userRefreshToken })
      .expect(401);
  });

  it('returns 404 for an unknown user id', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
