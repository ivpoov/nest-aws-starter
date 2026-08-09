import { configureApp } from '@helpers/configure-app.helper.js';
import { setupSwagger } from '@helpers/setup-swagger.helper.js';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// createTestApp() deliberately skips setupSwagger — every other suite talks
// to the API, not to the docs UI. This suite is the one place that needs
// both, because the whole point of the swagger exemption is that the docs
// route gets a different Content-Security-Policy than the JSON routes.
async function createDocumentedTestApp(): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: NestFastifyApplication = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: process.env.TRUST_PROXY === 'true' }),
  );

  await configureApp(app);
  setupSwagger(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}

describe('security headers', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createDocumentedTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('json api routes', () => {
    it('locks the content-security-policy down to nothing loadable', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);

      const policy: string = response.headers['content-security-policy'] ?? '';

      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("base-uri 'none'");
      expect(policy).toContain("form-action 'none'");
    });

    it('refuses mime sniffing and framing', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('sends a referrer policy', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);

      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });

    it('omits hsts outside production, where plain http is the norm', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/providers').expect(200);

      expect(response.headers['strict-transport-security']).toBeUndefined();
    });

    // Deliberately a core, non-removable route: any authenticated endpoint
    // produces the 401 this asserts on, and picking an optional module's route
    // would turn that module's removal into a failing security test.
    it('hardens error responses too, not only successful ones', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    });
  });

  describe('swagger route', () => {
    it('still renders the docs html', async () => {
      const response = await request(app.getHttpServer()).get('/docs').expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('swagger-ui');
    });

    it('serves the docs bundle the html asks for', async () => {
      await request(app.getHttpServer()).get('/docs/swagger-ui-bundle.js').expect(200);
    });

    it('relaxes the csp enough for the docs ui to execute', async () => {
      const response = await request(app.getHttpServer()).get('/docs').expect(200);

      const policy: string = response.headers['content-security-policy'] ?? '';

      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("script-src 'self'");
      expect(policy).toContain("style-src 'self' 'unsafe-inline'");
      expect(policy).not.toContain("default-src 'none'");
    });

    // The exemption is a different policy, not the absence of one: the docs
    // page has no inline scripts, so it never needs script-src loosened.
    it('grants inline only to styles, never to scripts', async () => {
      const response = await request(app.getHttpServer()).get('/docs').expect(200);

      const policy: string = response.headers['content-security-policy'] ?? '';

      expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(policy).not.toContain("'unsafe-eval'");
    });

    it('keeps the docs unframeable and unsniffable all the same', async () => {
      const response = await request(app.getHttpServer()).get('/docs').expect(200);

      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('leaves the json routes untouched by the docs exemption', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);

      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    });
  });
});
