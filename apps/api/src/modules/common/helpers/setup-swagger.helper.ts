import { createHash, timingSafeEqual } from 'node:crypto';
import type { SwaggerConfig } from '@configs/swagger.config.js';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type {
  DoneFuncWithErrOrRes,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';
import { StatusCodes } from 'http-status-codes';

const SWAGGER_PATH = 'docs';

// The one route in this app that is a real HTML document, so the one route
// the API-wide `default-src 'none'` policy would break — it loads scripts,
// styles, fonts and icons, and calls the API back from "Try it out". This is
// still a restrictive policy: same-origin only, no framing, no base or form
// hijacking, and no inline scripts. `'unsafe-inline'` is granted to styles
// alone, because the page Nest generates carries two inline <style> blocks
// and zero inline <script> blocks — if you add `customJs` or an inline
// script through SwaggerCustomOptions, widen script-src here deliberately
// rather than discovering a blank page.
const SWAGGER_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export function setupSwagger(app: NestFastifyApplication): void {
  const config: SwaggerConfig = app.get(ConfigService).getOrThrow<SwaggerConfig>('swagger');

  if (!config.isEnabled) return;

  if (config.user.length > 0 && config.password.length > 0) {
    guardWithBasicAuth(app, config);
  }

  relaxContentSecurityPolicyForDocs(app);

  const document: Omit<OpenAPIObject, 'paths'> = new DocumentBuilder()
    .setTitle('nest-aws-starter')
    .setVersion('0.1')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, document));
}

// Scoped to the docs prefix, and mounted only where the docs themselves are
// mounted: that is off in production unless SWAGGER_ENABLED is set explicitly,
// and the production boot guard then refuses to start without basic-auth
// credentials. So the exemption cannot outlive the UI it exists for.
//
// onSend, not onRequest: helmet writes the API-wide policy from an onRequest
// hook registered by a plugin, and plugin hooks land during Fastify's boot —
// after this file's synchronous addHook calls. Ordering within a phase would
// therefore be wrong. onSend is a later phase outright, so it wins regardless
// of registration order, today and after any reshuffle of bootstrap.
function relaxContentSecurityPolicyForDocs(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook(
      'onSend',
      (
        request: FastifyRequest,
        reply: FastifyReply,
        payload: unknown,
        done: DoneFuncWithErrOrRes,
      ): void => {
        if (request.url.startsWith(`/${SWAGGER_PATH}`)) {
          void reply.header('Content-Security-Policy', SWAGGER_CONTENT_SECURITY_POLICY);
        }

        done(null, payload);
      },
    );
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
