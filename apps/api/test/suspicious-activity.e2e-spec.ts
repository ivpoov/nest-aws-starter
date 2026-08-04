import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

describe('suspicious activity', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let userToken: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(
    displayName: string,
    ip: string = uniqueIp(),
  ): Promise<{
    email: string;
    password: string;
    accessToken: string;
    ip: string;
  }> {
    const email: string = `suspicious-e2e-${randomUUID()}@example.com`;
    const password = 'correct-horse-battery';
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', ip)
      .send({ displayName, email, password })
      .expect(201);

    return { email, password, accessToken: response.body.accessToken, ip };
  }

  async function userIdOf(email: string): Promise<string> {
    const method = await app.get(PrismaService).authMethod.findFirst({ where: { email } });

    return method?.userId ?? '';
  }

  async function failLogin(email: string, password: string, ip: string): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', ip)
      .send({ email, password })
      .expect(401);
  }

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await registerUser('Suspicious Admin E2E');
    userToken = admin.accessToken;

    await app.get(PrismaService).user.updateMany({
      where: { authMethods: { some: { email: admin.email } } },
      data: { role: 'ADMIN' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: admin.email, password: admin.password })
      .expect(200);

    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/suspicious/lockouts').expect(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/suspicious/lockouts')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');

    await request(app.getHttpServer())
      .delete('/api/v1/admin/suspicious/lockouts/anything')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  describe('per-email lockout', () => {
    it('locks the account after 5 failed attempts from 5 different ips, admin can list and release it', async () => {
      const target = await registerUser('Lockout Email Target E2E');

      // 5 different ips, one email — isolates the EMAIL counter from the IP counter.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await failLogin(target.email, 'wrong-password', uniqueIp());
      }

      // A fresh 6th ip, correct password: the lock — not the credentials — must
      // be what rejects this attempt.
      const locked = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-forwarded-for', uniqueIp())
        .send({ email: target.email, password: target.password })
        .expect(401);

      expect(locked.body.code).toBe('AUTH_TEMPORARILY_LOCKED');

      const list = await request(app.getHttpServer())
        .get('/api/v1/admin/suspicious/lockouts')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = list.body.items.find(
        (item: { scope: string; value: string }) =>
          item.scope === 'EMAIL' && item.value === target.email,
      );

      expect(entry).toBeTruthy();
      expect(entry.ttlSec).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/suspicious/lockouts/${entry.key}`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(204);

      const listAfterRelease = await request(app.getHttpServer())
        .get('/api/v1/admin/suspicious/lockouts')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        listAfterRelease.body.items.some(
          (item: { scope: string; value: string }) =>
            item.scope === 'EMAIL' && item.value === target.email,
        ),
      ).toBe(false);

      const restored = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-forwarded-for', uniqueIp())
        .send({ email: target.email, password: target.password })
        .expect(200);

      expect(restored.body.accessToken).toBeTruthy();
    });
  });

  describe('per-ip lockout', () => {
    it('locks the ip after 5 failed attempts against 5 different emails, admin can list and release it', async () => {
      const ip: string = uniqueIp();

      // 5 different (unregistered) emails, one ip — isolates the IP counter
      // from any single EMAIL counter (each stays at 1).
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await failLogin(`no-such-user-${randomUUID()}@example.com`, 'wrong-password', ip);
      }

      const list = await request(app.getHttpServer())
        .get('/api/v1/admin/suspicious/lockouts')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = list.body.items.find(
        (item: { scope: string; value: string }) => item.scope === 'IP' && item.value === ip,
      );

      expect(entry).toBeTruthy();
      expect(entry.ttlSec).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/suspicious/lockouts/${entry.key}`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(204);

      const listAfterRelease = await request(app.getHttpServer())
        .get('/api/v1/admin/suspicious/lockouts')
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        listAfterRelease.body.items.some(
          (item: { scope: string; value: string }) => item.scope === 'IP' && item.value === ip,
        ),
      ).toBe(false);
    });
  });

  describe('new device detection', () => {
    it('records an AUTH_NEW_DEVICE activity row only for a login from an unseen ip', async () => {
      const target = await registerUser('New Device Target E2E');
      const targetId: string = await userIdOf(target.email);

      // registerUser() already logged in from target.ip; re-login from the
      // SAME ip must not look new.
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-forwarded-for', target.ip)
        .send({ email: target.email, password: target.password })
        .expect(200);

      const sameIpActivities = await request(app.getHttpServer())
        .get(`/api/v1/admin/activities?type=AUTH_NEW_DEVICE&userId=${targetId}`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(sameIpActivities.body.items.length).toBe(0);

      // A fresh ip on the next login must look new.
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('x-forwarded-for', uniqueIp())
        .send({ email: target.email, password: target.password })
        .expect(200);

      const newIpActivity = await waitForActivity(async () => {
        const newIpActivities = await request(app.getHttpServer())
          .get(`/api/v1/admin/activities?type=AUTH_NEW_DEVICE&userId=${targetId}`)
          .set('authorization', `Bearer ${adminToken}`)
          .expect(200);

        return newIpActivities.body.items[0] ?? null;
      });

      expect(newIpActivity).toBeDefined();
      expect(newIpActivity.userId).toBe(targetId);
    });
  });
});
