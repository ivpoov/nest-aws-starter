import { createHash, timingSafeEqual } from 'node:crypto';
import type { SwaggerConfig } from '@configs/swagger.config.js';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { StatusCodes } from 'http-status-codes';

const SWAGGER_PATH = 'docs';

export function setupSwagger(app: NestFastifyApplication): void {
  const config: SwaggerConfig = app.get(ConfigService).getOrThrow<SwaggerConfig>('swagger');

  if (!config.isEnabled) return;

  if (config.user.length > 0 && config.password.length > 0) {
    guardWithBasicAuth(app, config);
  }

  const document: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
    .setTitle('nest-aws-starter')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, document));
}

function guardWithBasicAuth(app: NestFastifyApplication, config: SwaggerConfig): void {
  const credentials: string = Buffer.from(`${config.user}:${config.password}`).toString('base64');
  const expected: Buffer = createHash('sha256').update(`Basic ${credentials}`).digest();

  app
    .getHttpAdapter()
    .getInstance()
    .addHook(
      'onRequest',
      (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void => {
        const isDocsRequest: boolean = request.url.startsWith(`/${SWAGGER_PATH}`);
        const provided: Buffer = createHash('sha256')
          .update(request.headers.authorization ?? '')
          .digest();

        if (!isDocsRequest || timingSafeEqual(provided, expected)) {
          done();

          return;
        }

        void reply
          .header('WWW-Authenticate', 'Basic realm="API documentation"')
          .status(StatusCodes.UNAUTHORIZED)
          .send();
      },
    );
}
