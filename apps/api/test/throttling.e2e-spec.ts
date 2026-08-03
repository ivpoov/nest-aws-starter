import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('rate limiting', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('throttles register at its strict per-ip budget', async () => {
    const sharedIp = '10.99.99.99';
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('x-forwarded-for', sharedIp)
        .send({
          displayName: 'Throttle Probe',
          email: `throttle-${attempt}-${Date.now()}@example.com`,
          password: 'correct-horse-battery',
        });

      statuses.push(response.status);

      if (response.status === 429) {
        expect(response.headers['retry-after']).toBeDefined();

        break;
      }
    }

    expect(statuses).toContain(429);
  });

  it('never throttles health probes', async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    }
  });
});
