import { randomUUID } from 'node:crypto';
import type { TransactionStatus } from '@generated/prisma/enums.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('transactions', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(
    displayName: string,
  ): Promise<{ email: string; accessToken: string; id: string }> {
    const email: string = `transactions-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);

    return { email, accessToken: response.body.accessToken, id: me.body.id };
  }

  function seedTransaction(overrides: {
    userId: string;
    status?: TransactionStatus;
    amountCents?: number;
    createdAt?: Date;
  }): Promise<{ id: string }> {
    return prisma.paymentTransaction.create({
      data: {
        userId: overrides.userId,
        status: overrides.status ?? 'SUCCEEDED',
        amountCents: overrides.amountCents ?? 1900,
        currency: 'USD',
        provider: 'FAKE',
        providerRef: `txn_${randomUUID()}`,
        ...(overrides.createdAt && { createdAt: overrides.createdAt }),
      },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const admin = await registerUser('Transactions Admin E2E');
    const userA = await registerUser('Transactions User A E2E');
    const userB = await registerUser('Transactions User B E2E');

    userAToken = userA.accessToken;
    userAId = userA.id;
    userBToken = userB.accessToken;
    userBId = userB.id;

    await prisma.user.updateMany({
      where: { authMethods: { some: { email: admin.email } } },
      data: { role: 'ADMIN' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: admin.email, password: 'correct-horse-battery' })
      .expect(200);

    adminToken = login.body.accessToken;

    // userA: three transactions, one FAILED, one dated in the past.
    await seedTransaction({ userId: userAId, status: 'SUCCEEDED', amountCents: 1000 });
    await seedTransaction({ userId: userAId, status: 'SUCCEEDED', amountCents: 2000 });
    await seedTransaction({
      userId: userAId,
      status: 'FAILED',
      amountCents: 3000,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    // userB: one transaction — proves own-list scoping and admin userId filter.
    await seedTransaction({ userId: userBId, status: 'SUCCEEDED', amountCents: 500 });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /billing/transactions', () => {
    it('rejects unauthenticated callers', async () => {
      await request(app.getHttpServer()).get('/api/v1/billing/transactions').expect(401);
    });

    it('returns only the caller own transactions', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/billing/transactions?limit=100')
        .set('authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].amountCents).toBe(500);
      expect(response.body.items[0].userId).toBeUndefined();
      expect(response.body.nextCursor).toBeNull();
    });

    it('pages by cursor', async () => {
      const firstPage = await request(app.getHttpServer())
        .get('/api/v1/billing/transactions?limit=2')
        .set('authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(firstPage.body.items).toHaveLength(2);
      expect(firstPage.body.nextCursor).toBeTruthy();

      const secondPage = await request(app.getHttpServer())
        .get(`/api/v1/billing/transactions?limit=2&cursor=${firstPage.body.nextCursor}`)
        .set('authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(secondPage.body.items).toHaveLength(1);
      expect(secondPage.body.nextCursor).toBeNull();

      const allAmounts: number[] = [...firstPage.body.items, ...secondPage.body.items].map(
        (item: { amountCents: number }) => item.amountCents,
      );

      expect(allAmounts.sort()).toEqual([1000, 2000, 3000]);
    });
  });

  describe('GET /admin/transactions', () => {
    it('rejects unauthenticated and non-admin callers', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/transactions').expect(401);

      const forbidden = await request(app.getHttpServer())
        .get('/api/v1/admin/transactions')
        .set('authorization', `Bearer ${userAToken}`)
        .expect(403);

      expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
    });

    it('filters by userId, exposing the raw userId on each row', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/transactions?userId=${userAId}&limit=100`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(3);
      for (const item of response.body.items) {
        expect(item.userId).toBe(userAId);
      }
    });

    it('filters by status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/transactions?userId=${userAId}&status=FAILED`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].amountCents).toBe(3000);
    });

    it('filters by date range', async () => {
      const excludingPast = await request(app.getHttpServer())
        .get(`/api/v1/admin/transactions?userId=${userAId}&dateFrom=2026-01-01T00:00:00.000Z`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(excludingPast.body.items).toHaveLength(2);
      for (const item of excludingPast.body.items) {
        expect(item.amountCents).not.toBe(3000);
      }

      const includingPast = await request(app.getHttpServer())
        .get(`/api/v1/admin/transactions?userId=${userAId}&dateTo=2020-12-31T23:59:59.000Z`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(includingPast.body.items).toHaveLength(1);
      expect(includingPast.body.items[0].amountCents).toBe(3000);
    });

    it('pages by cursor across all admin transactions', async () => {
      const page = await request(app.getHttpServer())
        .get(`/api/v1/admin/transactions?userId=${userAId}&limit=1`)
        .set('authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(page.body.items).toHaveLength(1);
      expect(page.body.nextCursor).toBeTruthy();
    });
  });
});
