import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('cors', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers preflight for an allowed origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/auth/register')
      .set('origin', 'http://localhost:5173')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('reflects the allowed origin on simple requests', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'http://localhost:5174')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5174');
  });

  it('sends no allow-origin header for an unknown origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'https://evil.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
