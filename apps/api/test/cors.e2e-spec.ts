import type { AppConfig } from '@configs/app.config.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { createCorsProbeApp } from './helpers/cors-probe-app.helper.js';

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

  // The reason this rule exists: Vite silently falls back to the next free
  // port, so a developer with anything already on 5173/5174 lands on 5175 (or
  // 61234) and every call fails with an opaque browser CORS error. Outside
  // production any loopback port is accepted; the e2e suite runs with
  // NODE_ENV=test, which is "outside production".
  it('accepts a localhost origin on a port nobody configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'http://localhost:61234')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:61234');
  });

  it('accepts a 127.0.0.1 origin on a port nobody configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'http://127.0.0.1:61234')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:61234');
  });

  it('accepts the IPv6 loopback literal on a port nobody configured', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', 'http://[::1]:61234')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://[::1]:61234');
  });

  it('answers preflight for a loopback origin on an unconfigured port', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/auth/register')
      .set('origin', 'http://localhost:61234')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:61234');
  });

  // The loopback rule is a parsed-hostname comparison, never a prefix or a
  // substring test — this project has already shipped one origin check that
  // accepted `http://localhost:5173.evil.tld`. Each of these registers a
  // domain an attacker can own while carrying the word "localhost" somewhere
  // a sloppy check would find it.
  it.each([
    'http://localhost.evil.tld',
    'http://localhost.evil.tld:61234',
    'http://evil.tld/?x=localhost',
    'http://evil.tld#localhost',
    'http://127.0.0.1.evil.tld',
    'http://localhost:5173@evil.tld',
    'https://localhost:61234',
  ])('sends no allow-origin header for the localhost lookalike %s', async (origin: string) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/providers')
      .set('origin', origin)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
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

// The loopback latitude above is development-only, and this is where that is
// proved end to end rather than at the unit seam: a real Fastify server wired
// by the real `configureApp`, differing from the suite above in nothing but
// `AppConfig.env`. Every loopback origin the suite above is granted is
// refused here.
describe('cors (env: production)', () => {
  const CONFIGURED_ORIGIN: string = 'https://app.example.com';
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const config: AppConfig = {
      port: 0,
      env: 'production',
      apiPrefix: 'api',
      trustProxy: false,
      corsOrigins: [CONFIGURED_ORIGIN],
    };

    app = await createCorsProbeApp(config);
  });

  afterAll(async () => {
    await app.close();
  });

  it('grants the exact configured origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/anything')
      .set('origin', CONFIGURED_ORIGIN);

    expect(response.headers['access-control-allow-origin']).toBe(CONFIGURED_ORIGIN);
  });

  it.each([
    'http://localhost:5173',
    'http://localhost:5175',
    'http://localhost:61234',
    'http://127.0.0.1:61234',
    'http://[::1]:61234',
    'https://app.example.com.evil.tld',
    'https://evil.app.example.com',
  ])('withholds the grant from %s', async (origin: string) => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/anything')
      .set('origin', origin);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('withholds the preflight grant from a loopback origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/anything')
      .set('origin', 'http://localhost:61234')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'content-type');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('never answers any origin with a wildcard grant', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/anything')
      .set('origin', 'http://localhost:61234');

    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });
});
