import type { AppConfig } from '@configs/app.config.js';
import { configureApp } from '@helpers/configure-app.helper.js';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';

// A real Fastify app wired by the real `configureApp` — the same function
// main.ts and app.factory.ts call — over an AppConfig handed in directly.
// That is what makes `env: 'production'` testable at the HTTP level: booting
// the whole AppModule with NODE_ENV=production is impossible on purpose (the
// production boot guard refuses, and it must keep refusing), so the config
// object is substituted rather than the environment.
//
// No controllers: @fastify/cors answers preflights itself and adds its
// headers in an onRequest hook, before routing, so a 404 route carries the
// same CORS grant (or the same absence of one) every real route does.
export async function createCorsProbeApp(config: AppConfig): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      {
        provide: ConfigService,
        useValue: { getOrThrow: (): AppConfig => config },
      },
    ],
  }).compile();

  const app: NestFastifyApplication = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
