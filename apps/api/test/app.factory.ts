import { configureApp } from '@helpers/configure-app.helper.js';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Mirrors main.ts's trustProxy wiring — e2e specs vary x-forwarded-for per
  // request to exercise per-ip logic (throttling, lockouts, session ip).
  const app: NestFastifyApplication = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: process.env.TRUST_PROXY === 'true' }),
  );

  configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
