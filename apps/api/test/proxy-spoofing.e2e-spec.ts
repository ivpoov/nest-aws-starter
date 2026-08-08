import { randomUUID } from 'node:crypto';
import { configureApp } from '@helpers/configure-app.helper.js';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Every other e2e suite runs with TRUST_PROXY=true, because varying
// x-forwarded-for per request is how they keep per-ip budgets apart. This
// suite is the inverse proof: with TRUST_PROXY off — the correct setting for
// an API reachable directly, without an ALB/CloudFront in front — a client
// must not be able to mint itself a fresh rate-limit budget by inventing an
// x-forwarded-for header. The whole app is rebuilt here with the flag off,
// because trustProxy is read once, at adapter construction and at config
// registration.
async function createUntrustedProxyApp(): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: NestFastifyApplication = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: false }),
  );

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

// POST /auth/register is the tightest budget in the app (3 per minute), so a
// handful of calls is enough to show whether the tracker moved.
const REGISTER_LIMIT = 3;
const ATTEMPTS = REGISTER_LIMIT + 3;

describe('x-forwarded-for spoofing with TRUST_PROXY off', () => {
  let app: NestFastifyApplication;
  let previousTrustProxy: string | undefined;

  beforeAll(async () => {
    previousTrustProxy = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = 'false';

    app = await createUntrustedProxyApp();
  });

  afterAll(async () => {
    await app.close();

    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  });

  it('does not hand out a fresh rate-limit budget per forged client ip', async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        // A different forged ip every single call. If the header were
        // honoured, each call would be a brand new tracker and 429 would
        // never appear.
        .set('x-forwarded-for', `203.0.113.${attempt}`)
        .send({
          displayName: 'Spoof Probe',
          email: `spoof-${randomUUID()}@example.com`,
          password: 'correct-horse-battery',
        });

      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
  });

  it('keeps the shared budget exhausted no matter how the header changes', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', `198.51.100.${Math.floor(Math.random() * 250)}`)
      .send({
        displayName: 'Spoof Probe',
        email: `spoof-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(429);

    expect(response.headers['retry-after']).toBeDefined();
  });

  it('ignores a comma-chained forwarded-for just the same', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', '203.0.113.250, 10.0.0.1, 172.16.0.1')
      .send({
        displayName: 'Spoof Probe',
        email: `spoof-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(429);
  });
});
