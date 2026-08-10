import type { AppConfig } from '@configs/app.config.js';
import { createCorsOriginDelegate } from '@helpers/create-cors-origin-delegate.helper.js';
import { registerSecurityHeaders } from '@helpers/register-security-headers.helper.js';
import { AllExceptionsFilter } from '@modules/common/filters/all-exceptions.filter.js';
import type { CorsOriginDelegateType } from '@modules/common/types/cors-origin-delegate.type.js';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export async function configureApp(app: NestFastifyApplication): Promise<void> {
  const config: AppConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
  // The configured allowlist, plus any loopback port while `env` is not
  // production — see create-cors-origin-delegate.helper.ts for why the
  // latitude lives in the check and not in CORS_ORIGINS itself.
  const corsOrigin: CorsOriginDelegateType = createCorsOriginDelegate(config);

  await registerSecurityHeaders(app);

  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 3600,
    // `credentials` is deliberately left off (the cors default is false) and
    // must stay off. This API is bearer-only: the access token travels in the
    // Authorization header, the refresh token in a request body, and the
    // socket token in the Socket.IO handshake payload. Nothing here sets a
    // cookie, reads a cookie, or uses any other ambient credential — grep the
    // tree for Set-Cookie and you will find none.
    //
    // Access-Control-Allow-Credentials: true is what tells a browser it may
    // attach ambient credentials to a cross-origin call and hand the response
    // back to the calling page. With no ambient credentials to attach it buys
    // this API exactly nothing, while permanently coupling the allowlist to a
    // CSRF exposure: any bug that widens corsOrigins (a wildcard, a
    // regex that over-matches, a compromised subdomain) turns from "an
    // attacker's page can make unauthenticated calls" into "an attacker's page
    // can make calls as the logged-in user".
    //
    // So: if a future change makes a browser request fail with a CORS error,
    // the fix is the allowlist or the header list — never this flag. Turning
    // it on is only correct alongside a deliberate move to cookie-based auth,
    // which is a different design with its own CSRF defences (SameSite, an
    // anti-forgery token) that this starter does not ship.
    credentials: false,
  });
  app.setGlobalPrefix(config.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
}
