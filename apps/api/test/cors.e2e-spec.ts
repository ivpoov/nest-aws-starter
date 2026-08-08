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

  // A browser treats a preflight with no matching Access-Control-Allow-Origin
  // as a refusal and never issues the real request, so "rejected" for CORS
  // means exactly this: the grant is withheld. The allow-methods/allow-headers
  // echo that the preflight still carries is inert on its own — without an
  // allow-origin the browser discards the whole response. Asserted for the
  // preflight as well as for the simple request above, because a preflight
  // that quietly answered with a wildcard would be the actual hole.
  it('withholds the preflight grant from a disallowed origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/auth/register')
      .set('origin', 'https://evil.example')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'content-type');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('never answers any origin with a wildcard grant', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'https://sub.evil.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  // credentials: false is deliberate, not an omission — see the comment on
  // enableCors in configure-app.helper.ts. This API is bearer-only and sets
  // no cookies anywhere, so the browser must never be told it may attach
  // ambient credentials to a cross-origin call.
  it('never grants credentialed cross-origin requests', async () => {
    const simpleResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'http://localhost:5173')
      .expect(200);

    const preflightResponse = await request(app.getHttpServer())
      .options('/api/v1/auth/register')
      .set('origin', 'http://localhost:5173')
      .set('access-control-request-method', 'POST')
      .expect(204);

    expect(simpleResponse.headers['access-control-allow-credentials']).toBeUndefined();
    expect(preflightResponse.headers['access-control-allow-credentials']).toBeUndefined();
  });
});
