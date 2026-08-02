import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '@configs/app.config.js';
import { configureApp } from '@helpers/configure-app.helper.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RequestContextService } from '@modules/logger/services/request-context.service.js';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const adapter: FastifyAdapter = new FastifyAdapter();

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
    { bufferLogs: true },
  );
  const config: AppConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

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
