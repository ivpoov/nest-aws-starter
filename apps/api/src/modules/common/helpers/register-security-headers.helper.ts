import type { AppConfig } from '@configs/app.config.js';
import helmet from '@fastify/helmet';
import { ConfigService } from '@nestjs/config';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

const ONE_YEAR_IN_SECONDS = 31_536_000;

// Response headers are a transport concern, so they are set once here for
// every route rather than per controller. @fastify/helmet (over helmet) is
// preferred to hand-written `reply.header(...)` calls for one reason that
// matters more than convenience: the header *values* are the part that ages
// badly — HSTS preload rules, the CSP directive set, the headers browsers
// have since retired — and helmet tracks that upstream, under a CVE process,
// where a hand-rolled hook in this repository would silently not.
//
// The defaults are tuned down, not up: helmet ships for HTML apps, and most
// of what it protects (script injection, framing of a rendered page) has no
// meaning for a JSON API. What is left is the set below.
export async function registerSecurityHeaders(app: NestFastifyApplication): Promise<void> {
  const config: AppConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
  const isProduction: boolean = config.env === 'production';

  await app.register(helmet, {
    // A JSON API loads nothing and is loaded by nothing, so the honest CSP
    // is the empty one: `default-src 'none'` covers every fetch directive at
    // once. It costs a browser client nothing (CSP restricts what a *document*
    // may load, and this response is never a document) and it turns any
    // route that starts returning HTML — an error page, a misrouted static
    // file, a reflected-payload bug — into an inert page instead of a
    // scriptable one. `frame-ancestors 'none'` is the modern X-Frame-Options
    // and is honoured even in a `default-src 'none'` policy, where it would
    // otherwise not be covered: frame-ancestors has no fallback to
    // default-src.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // Production only. Sending HSTS from a development server that is reached
    // over plain http://localhost pins the whole localhost origin to https in
    // the developer's browser — including every *other* project on
    // localhost — and the pin outlives the process that set it.
    strictTransportSecurity: isProduction
      ? { maxAge: ONE_YEAR_IN_SECONDS, includeSubDomains: true, preload: true }
      : false,
    // The API is a cross-origin endpoint for both SPAs; a Referer carrying a
    // path (and possibly an id) has no legitimate reader here.
    referrerPolicy: { policy: 'no-referrer' },
    // helmet defaults this to SAMEORIGIN. Nothing in this project frames the
    // API or the docs, so it matches `frame-ancestors 'none'` instead — the
    // legacy header for the browsers that still only read it.
    xFrameOptions: { action: 'deny' },
    // Kept from helmet's defaults, deliberately: X-Content-Type-Options,
    // Cross-Origin-Resource-Policy: same-origin,
    // Cross-Origin-Opener-Policy, Origin-Agent-Cluster, X-DNS-Prefetch-Control.
    // CORP is safe at same-origin here because nothing this API returns is
    // ever loaded as a no-cors subresource — file downloads are presigned
    // S3/CloudFront URLs, not bytes served from these routes, and the SPAs
    // reach the API exclusively through CORS-mode fetches, which CORP does
    // not gate.
  });
}
