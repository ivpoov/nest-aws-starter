import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '@configs/app.config.js';
import { configureApp } from '@helpers/configure-app.helper.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RequestContextService } from '@modules/logger/services/request-context.service.js';
import { installWebsocketAdapter } from '@modules/notification/helpers/install-websocket-adapter.helper.js'; // <module:notification>
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { config as loadEnv } from 'dotenv';
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  // ConfigModule's own .env loading only runs once AppModule resolves, which
  // is after the adapter is built — load early so TRUST_PROXY is already in
  // process.env when Fastify decides whether to honor X-Forwarded-For.
  loadEnv();

  const adapter: FastifyAdapter = new FastifyAdapter({
    trustProxy: process.env.TRUST_PROXY === 'true',
  });

  adapter
    .getInstance()
    .addHook(
      'onRequest',
      (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
        const headerValue: string | string[] | undefined = request.headers['x-request-id'];
        const requestId: string = typeof headerValue === 'string' ? headerValue : randomUUID();

        void reply.header('X-Request-Id', requestId);
        RequestContextService.run(requestId, done);
      },
    );

  const app: NestFastifyApplication = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    // rawBody: true exposes request.rawBody (a Buffer of the exact bytes
    // received) alongside the normal parsed body, on every route — Fastify's
    // JSON parsing is untouched. Only the webhook ingest controller reads
    // it today (Stripe's constructEvent needs the exact bytes to verify a
    // signature), but this is application-wide because rawBody is a NestJS
    // bootstrap option, not something a single route can opt into.
    { bufferLogs: true, rawBody: true },
  );
  const config: AppConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

  // <module:notification>
  // Must be wired before app.listen() (which calls app.init() internally)
  // so the gateway's namespace binds against the configured adapter from
  // the start: Redis-backed when WEBSOCKET_ENABLED, a detached no-op server
  // (no socket endpoint, no Redis pub/sub) when disabled.
  await installWebsocketAdapter(app);
  // </module:notification>

  app.useLogger(new CustomLoggerService('App'));
  app.enableShutdownHooks();
  configureApp(app);

  if (config.env !== 'production') {
    const swaggerConfig: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
      .setTitle('nest-aws-starter')
      .setVersion('0.1')
      .addBearerAuth()
      .build();

    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

void bootstrap();
