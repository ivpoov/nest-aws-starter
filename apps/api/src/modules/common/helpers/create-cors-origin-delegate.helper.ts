import type { AppConfig } from '@configs/app.config.js';
import type { CorsOriginDelegateType } from '@modules/common/types/cors-origin-delegate.type.js';

// Bracketed exactly as `URL.hostname` serialises an IPv6 literal, so the
// comparison below stays a plain equality check. `[::1]` is in: it is the
// IPv6 counterpart of 127.0.0.1 that a dual-stack dev server prints, it can
// never be a registrable domain someone else owns (the brackets make it
// unambiguously an address literal), and the production guard already counts
// it as loopback — leaving it out would be the two lists disagreeing about
// what "loopback" means. `0.0.0.0` is deliberately out: it is not a browsable
// origin, only a bind address.
const LOOPBACK_HOSTNAMES: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

// Why a delegate and not a wider `corsOrigins` list: `CORS_ORIGINS` is the
// string the production boot guard inspects
// (collect-production-violations.helper.ts refuses `NODE_ENV=production` when
// it holds a wildcard or a loopback address). Widening the list to make dev
// work would either trip that guard or force it to learn exceptions. The list
// therefore stays exactly what the operator configured, and the extra
// development latitude lives here, gated on the resolved `AppConfig.env` —
// so `env === 'production'` is the exact allowlist and nothing else, with no
// env var, header or regex that can re-enable the loopback rule.
//
// One delegate serves both consumers: configure-app.helper.ts feeds it to
// `enableCors`, redis-io.adapter.ts feeds it to the Socket.IO server, both
// built from the same resolved AppConfig object. HTTP and WS cannot diverge.
export function createCorsOriginDelegate(config: AppConfig): CorsOriginDelegateType {
  const allowlist: ReadonlySet<string> = new Set<string>(config.corsOrigins);
  const allowsLoopback: boolean = config.env !== 'production';

  return (
    requestOrigin: string | undefined,
    callback: (error: Error | null, isAllowed: boolean) => void,
  ): void => {
    // No Origin header means it is not a cross-origin browser request; there
    // is nothing to grant, which is also what the plain array form did.
    if (requestOrigin === undefined) {
      callback(null, false);

      return;
    }

    const isAllowed: boolean =
      allowlist.has(requestOrigin) || (allowsLoopback && isLoopbackOrigin(requestOrigin));

    callback(null, isAllowed);
  };
}

// Parsed and compared as an authority, never matched as a string. A
// `startsWith`/`includes`/loose-regex check here would accept
// `http://localhost.evil.tld`, `http://localhost:5173.evil.tld` or
// `http://localhost:5173@evil.tld` — all domains an attacker can register or
// point anywhere. `URL` resolves each of those to a hostname that is not in
// the table above. This project has already shipped that bug once in an
// origin check; it does not ship it twice.
function isLoopbackOrigin(requestOrigin: string): boolean {
  const url: URL | null = parseOrigin(requestOrigin);

  if (url === null) return false;
  // `https://localhost:*` is not granted: a dev server that terminates TLS is
  // a deliberate setup whose origin belongs in CORS_ORIGINS. The port is what
  // Vite picks for you and therefore what this rule exists to absorb; the
  // scheme is not.
  if (url.protocol !== 'http:') return false;

  return LOOPBACK_HOSTNAMES.includes(url.hostname.toLowerCase());
}

function parseOrigin(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
