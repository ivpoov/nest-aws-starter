import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

describe('error envelope', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the coded envelope for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/unknown').expect(404);

    expect(typeof response.body.code).toBe('string');
    expect(response.body.statusCode).toBe(404);
    expect(response.body.path).toBe('/api/v1/unknown');
    expect(typeof response.body.details).toBe('string');
    expect(typeof response.body.timestamp).toBe('string');
  });
});
