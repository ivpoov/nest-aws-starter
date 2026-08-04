import { randomUUID } from 'node:crypto';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

interface CreateApiKeyBodyInterface {
  readonly id: string;
  readonly name: string;
  readonly key: string;
  readonly prefix: string;
  readonly createdAt: string;
}

interface ApiKeyBodyInterface {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

interface ActivityBodyInterface {
  readonly type: string;
  readonly actorId: string | null;
  readonly meta: Record<string, unknown> | null;
}

describe('api keys', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let adminId: string;
  let userToken: string;

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUser(displayName: string): Promise<{
    email: string;
    accessToken: string;
  }> {
    const email: string = `api-key-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({ displayName, email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, accessToken: response.body.accessToken };
  }

  // POST /admin/api-keys has its own strict per-ip throttle (10/60s) — this
  // spec creates more than 10 keys across its cases, so each call gets a
  // fresh ip to stay under that unrelated budget (not the one under test).
  async function createApiKey(
    name: string = `key ${randomUUID()}`,
  ): Promise<CreateApiKeyBodyInterface> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/admin/api-keys')
      .set('authorization', `Bearer ${adminToken}`)
      .set('x-forwarded-for', uniqueIp())
      .send({ name })
      .expect(201);

    return response.body as CreateApiKeyBodyInterface;
  }

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await registerUser('Api Key Admin E2E');
    userToken = (await registerUser('Api Key User E2E')).accessToken;

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

    const foundAdmin = await app
      .get(PrismaService)
      .authMethod.findFirst({ where: { email: admin.email } });

    adminId = foundAdmin?.userId ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated and non-admin callers on the management endpoints', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/api-keys').expect(401);

    const forbidden = await request(app.getHttpServer())
      .get('/api/v1/admin/api-keys')
      .set('authorization', `Bearer ${userToken}`)
      .expect(403);

    expect(forbidden.body.code).toBe('CASL_FORBIDDEN');
  });

  it('creates a key, reveals the plaintext once, and never returns it again from the list', async () => {
    const name = `reveal-once ${randomUUID()}`;

    const created = await createApiKey(name);

    expect(created.key).toMatch(/^sk_[A-Za-z0-9_-]{48}$/);
    expect(created.prefix).toBe(created.key.slice(0, 8));
    expect(created.name).toBe(name);

    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/api-keys?limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const listed = (list.body.items as ApiKeyBodyInterface[]).find(
      (item) => item.id === created.id,
    );

    expect(listed).toBeDefined();
    expect(listed?.prefix).toBe(created.prefix);
    expect(listed).not.toHaveProperty('key');
    expect(JSON.stringify(list.body)).not.toContain(created.key);
  });

  it('records an API_KEY_CREATED activity row for the creating admin', async () => {
    const created = await createApiKey();

    const activities = await request(app.getHttpServer())
      .get('/api/v1/admin/activities?type=API_KEY_CREATED&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matching = (activities.body.items as ActivityBodyInterface[]).find(
      (item) => (item.meta as { apiKeyId?: string } | null)?.apiKeyId === created.id,
    );

    expect(matching).toBeDefined();
    expect(matching?.actorId).toBe(adminId);
  });

  it('whoami: 200 with a valid key, 401 for missing/garbage/revoked keys', async () => {
    const created = await createApiKey();

    const ok = await request(app.getHttpServer())
      .get('/api/v1/api-demo/whoami')
      .set('X-Api-Key', created.key)
      .expect(200);

    expect(ok.body.keyName).toBe(created.name);

    await request(app.getHttpServer()).get('/api/v1/api-demo/whoami').expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/api-demo/whoami')
      .set('X-Api-Key', 'sk_totally-not-a-real-key')
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/api-keys/${created.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/v1/api-demo/whoami')
      .set('X-Api-Key', created.key)
      .expect(401);
  });

  it('revoke is idempotent (204 twice) and 404s for an unknown id', async () => {
    const created = await createApiKey();

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/api-keys/${created.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/api-keys/${created.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/api-keys/${randomUUID()}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('records an API_KEY_REVOKED activity row for the revoking admin', async () => {
    const created = await createApiKey();

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/api-keys/${created.id}`)
      .set('authorization', `Bearer ${adminToken}`)
      .expect(204);

    const activities = await request(app.getHttpServer())
      .get('/api/v1/admin/activities?type=API_KEY_REVOKED&limit=100')
      .set('authorization', `Bearer ${adminToken}`)
      .expect(200);

    const matching = (activities.body.items as ActivityBodyInterface[]).find(
      (item) => (item.meta as { apiKeyId?: string } | null)?.apiKeyId === created.id,
    );

    expect(matching).toBeDefined();
    expect(matching?.actorId).toBe(adminId);
  });

  // Demo route's per-key budget is deliberately low (limit 3) to make this
  // provable without hundreds of requests. The GLOBAL ip-based throttler
  // stays at its generous default for this route, so both keys below share
  // an ip well under that budget — only the ApiKeyThrottlerGuard's per-key
  // counter should trip.
  it('per-key rate budget: 3 calls ok, 4th 429, a different key from the same ip still gets 200', async () => {
    const keyA = await createApiKey();
    const keyB = await createApiKey();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer())
        .get('/api/v1/api-demo/whoami')
        .set('X-Api-Key', keyA.key)
        .expect(200);
    }

    const fourth = await request(app.getHttpServer())
      .get('/api/v1/api-demo/whoami')
      .set('X-Api-Key', keyA.key);

    expect(fourth.status).toBe(429);

    await request(app.getHttpServer())
      .get('/api/v1/api-demo/whoami')
      .set('X-Api-Key', keyB.key)
      .expect(200);
  });
});
