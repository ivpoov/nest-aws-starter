import { configureApp } from '@helpers/configure-app.helper.js';
import { installWebsocketAdapter } from '@modules/notification/helpers/install-websocket-adapter.helper.js'; // <module:notification>
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '@src/app.module.js';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Mirrors main.ts's trustProxy + rawBody wiring — e2e specs vary
  // x-forwarded-for per request to exercise per-ip logic (throttling,
  // lockouts, session ip), and the webhook e2e suite needs request.rawBody.
  const app: NestFastifyApplication = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ trustProxy: process.env.TRUST_PROXY === 'true' }),
    { rawBody: true },
  );

  // <module:notification>
  // Mirrors main.ts's adapter wiring — must happen before app.init() so any
  // e2e suite that opens a socket (websocket.e2e-spec.ts) connects through
  // the same adapter production uses, and the disabled path is the same
  // no-socket-endpoint path production gets.
  await installWebsocketAdapter(app);
  // </module:notification>

  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return app;
}
