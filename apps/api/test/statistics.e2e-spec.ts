import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('admin statistics', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let redis: RedisClientType;
  let adminToken: string;
  let userToken: string;
  let userId: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(
    displayName: string,
  ): Promise<{ email: string; accessToken: string; id: string }> {
    const email: string = `statistics-e2e-${randomUUID()}@example.com`;
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

  // Direct Prisma writes (plan/subscription/transaction) mirror the pattern
  // in test/transactions.e2e-spec.ts — there is no checkout flow to hit in
  // this suite (that lives in payment's own e2e specs), and the statistics
  // TypedSQL reads these tables regardless of how the rows got there.
  async function seedRevenueFixture(): Promise<{ planId: string; amountCents: number }> {
    const amountCents = 2_500;
    const plan = await prisma.plan.create({
      data: {
        name: `Statistics E2E Plan ${randomUUID()}`,
        amountCents,
        currency: 'USD',
        intervalDays: 30,
      },
    });
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        provider: 'FAKE',
        providerRef: `sub_${randomUUID()}`,
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.paymentTransaction.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        status: 'SUCCEEDED',
        amountCents,
        currency: 'USD',
        provider: 'FAKE',
        providerRef: `txn_${randomUUID()}`,
      },
    });

    return { planId: plan.id, amountCents };
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    redis = app.get<RedisClientType>(REDIS_CLIENT);

    const admin = await registerUser('Statistics Admin E2E');
    const user = await registerUser('Statistics User E2E');

    userToken = user.accessToken;
    userId = user.id;

    // promote directly in the database — there is deliberately no promote endpoint
    await app.get(PrismaService).user.updateMany({
      where: { authMethods: { some: { email: admin.email } } },
      data: { role: 'ADMIN' },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-forwarded-for', uniqueIp())
      .send({ email: admin.email, password: 'correct-horse-battery' })
      .expect(200);

    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/statistics/overview').expect(401);

    const forbiddenOverview = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbiddenOverview.body.code).toBe('CASL_FORBIDDEN');

    await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/series?metric=REGISTRATIONS')
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/series?metric=REGISTRATIONS')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('returns overview totals reflecting the seeded users/sessions', async () => {
    // Clear so this test observes a fresh aggregate rather than another
    // suite's cached payload — the cache-behaviour assertions live below.
    await redis.del('statistic:overview');

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.totals.users).toBeGreaterThanOrEqual(2);
    expect(response.body.totals.activeSessions).toBeGreaterThanOrEqual(2);
    expect(response.body.totals.onlineNow).toBeGreaterThanOrEqual(1);
    expect(response.body.totals.newToday).toBeGreaterThanOrEqual(2);
    // The payment module is present in this suite, so revenue/mrr are real
    // numbers (>= 0) rather than the v0.3 null stub — see the dedicated
    // revenue-fixture test below for the exact-delta proof.
    expect(typeof response.body.totals.revenue).toBe('number');
    expect(response.body.totals.revenue).toBeGreaterThanOrEqual(0);
    expect(typeof response.body.totals.mrrCents).toBe('number');
    expect(response.body.totals.mrrCents).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(response.body.revenueByPlan)).toBe(true);
    expect(Array.isArray(response.body.usersByStatus)).toBe(true);
    expect(response.body.usersByStatus.length).toBeGreaterThan(0);
    expect(Array.isArray(response.body.authMethodDistribution)).toBe(true);
    expect(response.body.authMethodDistribution.length).toBeGreaterThan(0);
  });

  it('reflects a new plan/subscription/transaction in revenue, mrr, and the by-plan breakdown', async () => {
    await redis.del('statistic:overview');

    const before = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const fixture = await seedRevenueFixture();

    await redis.del('statistic:overview');

    const after = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Exact deltas: e2e specs run sequentially in this suite
    // (fileParallelism: false) and nothing else writes payment_transactions
    // between the two calls above, so the fixture's contribution is isolated.
    expect(after.body.totals.revenue - before.body.totals.revenue).toBe(fixture.amountCents);
    expect(after.body.totals.mrrCents - before.body.totals.mrrCents).toBe(fixture.amountCents);

    const planRow = after.body.revenueByPlan.find(
      (row: { planId: string }) => row.planId === fixture.planId,
    );

    expect(planRow).toEqual({
      planId: fixture.planId,
      planName: expect.any(String),
      amountCents: fixture.amountCents,
    });
  });

  it('serves REVENUE series points reflecting the day-bucketed transaction totals', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/series?metric=REVENUE&days=5')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.metric).toBe('REVENUE');
    expect(response.body.days).toBe(5);
    expect(response.body.points).toHaveLength(5);

    for (const point of response.body.points) {
      expect(typeof point.date).toBe('string');
      expect(typeof point.value).toBe('number');
    }
  });

  it('rejects an unknown metric with 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/series?metric=BOGUS')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('returns exactly `days` gap-filled points, zeros included', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/series?metric=REGISTRATIONS&days=5')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.metric).toBe('REGISTRATIONS');
    expect(response.body.days).toBe(5);
    expect(response.body.points).toHaveLength(5);

    for (const point of response.body.points) {
      expect(typeof point.date).toBe('string');
      expect(typeof point.value).toBe('number');
      expect(point.value).toBeGreaterThanOrEqual(0);
    }
  });

  it('caches the overview payload for the ttl window', async () => {
    await redis.del('statistic:overview');

    const first = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const cachedRaw: string | null = await redis.get('statistic:overview');

    expect(cachedRaw).not.toBeNull();

    const ttlMs: number = await redis.pttl('statistic:overview');

    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(60_000);

    // A registration during the ttl window must not move totals.users in the
    // cached payload — proof the second call served from cache, not TypedSQL.
    await registerUser('Statistics Cache Buster E2E');

    const second = await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(second.body).toEqual(first.body);
  });

  it('serves the second overview call entirely from cache — zero TypedSQL queries', async () => {
    await redis.del('statistic:overview');

    const querySpy = vi.spyOn(prisma, '$queryRawTyped');

    await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    // The cache miss above must have run at least one TypedSQL query — a
    // spy asserting zero calls on both legs would trivially pass if wiring
    // broke and nothing ever queried at all.
    expect(querySpy.mock.calls.length).toBeGreaterThan(0);

    querySpy.mockClear();

    await request(app.getHttpServer())
      .get('/api/v1/admin/statistics/overview')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(querySpy).not.toHaveBeenCalled();

    querySpy.mockRestore();
  });
});
