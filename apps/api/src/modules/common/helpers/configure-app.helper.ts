import type { AppConfig } from '@configs/app.config.js';
import { AllExceptionsFilter } from '@modules/common/filters/all-exceptions.filter.js';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureApp(app: NestFastifyApplication): void {
  const config: AppConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');

  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 3600,
  });
  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
}
