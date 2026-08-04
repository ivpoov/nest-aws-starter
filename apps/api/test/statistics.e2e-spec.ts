import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('admin statistics', () => {
  let app: NestFastifyApplication;
  let redis: RedisClientType;
  let adminToken: string;
  let userToken: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(
    displayName: string,
  ): Promise<{ email: string; accessToken: string }> {
    const email: string = `statistics-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, accessToken: response.body.accessToken };
  }

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get<RedisClientType>(REDIS_CLIENT);

    const admin = await registerUser('Statistics Admin E2E');
    const user = await registerUser('Statistics User E2E');

    userToken = user.accessToken;

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
    expect(response.body.totals.revenue).toBeNull();
    expect(Array.isArray(response.body.usersByStatus)).toBe(true);
    expect(response.body.usersByStatus.length).toBeGreaterThan(0);
    expect(Array.isArray(response.body.authMethodDistribution)).toBe(true);
    expect(response.body.authMethodDistribution.length).toBeGreaterThan(0);
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
});
