import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';

// This suite deliberately goes through `createTestApp()` — the same AppModule,
// the same ConfigModule.forRoot({ load: configs }) wiring every other e2e
// suite and main.ts boot through — instead of calling the guard directly. The
// point is not that the validator returns violations; it is that a production
// process carrying them never finishes starting.
describe('production boot guard (e2e)', () => {
  let app: NestFastifyApplication | null = null;

  afterEach(async () => {
    vi.unstubAllEnvs();

    if (app) {
      await app.close();
      app = null;
    }
  });

  it('refuses to boot with NODE_ENV=production and the shipped development defaults', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', 'local-development-secret-change-me-32chars');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'test');
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174');
    vi.stubEnv('SWAGGER_ENABLED', 'true');
    vi.stubEnv('SWAGGER_USER', '');
    vi.stubEnv('SWAGGER_PASSWORD', '');

    await expect(createTestApp()).rejects.toThrow(/Refusing to boot with NODE_ENV=production/);
  });

  it('names every offending variable in one boot attempt', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_JWT_SECRET', 'local-development-secret-change-me-32chars');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'test');
    vi.stubEnv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174');
    vi.stubEnv('SWAGGER_ENABLED', 'true');
    vi.stubEnv('SWAGGER_USER', '');
    vi.stubEnv('SWAGGER_PASSWORD', '');

    const message: string = await createTestApp().then(
      (): string => '',
      (error: Error): string => error.message,
    );

    expect(message).toContain('AUTH_JWT_SECRET');
    expect(message).toContain('AWS_ACCESS_KEY_ID');
    expect(message).toContain('http://localhost:5173');
    expect(message).toContain('SWAGGER_USER');
    expect(message).toContain('PRODUCTION_DEVELOPMENT_DEFAULT');
    expect(message).toContain('PRODUCTION_WEAK_JWT_SECRET');
    expect(message).toContain('PRODUCTION_UNSAFE_CORS_ORIGIN');
    expect(message).toContain('PRODUCTION_UNAUTHENTICATED_SWAGGER');
  });

  it('still boots on the shipped defaults outside production', async () => {
    app = await createTestApp();

    expect(app).toBeDefined();
  });
});
