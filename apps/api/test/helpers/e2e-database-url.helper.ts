// The e2e suite writes real rows through the real app — there is no
// transaction to roll back, because every request runs on the application's
// own connection pool, not the test's. Left pointing at DATABASE_URL, the
// suite therefore fills the database a developer's dev app reads from, and
// keeps filling it on every re-run. Both reported symptoms come from that:
// the dev app showing `Throttle Probe` / `e2e-<uuid>@example.com` accounts,
// and billing.e2e-spec.ts failing once enough stale plans accumulated to
// push its freshly created plan past a 100-row page cap.
//
// So the suite gets its own database, derived from DATABASE_URL rather than
// configured separately: `starter` → `starter_e2e`. Nothing a developer or
// CI sets has to change, and the dev database is never opened by the suite
// at all — not truncated, not "mostly" cleaned, simply not touched.
//
// Idempotent: an already-derived URL is returned unchanged, so exporting the
// e2e URL as DATABASE_URL (to inspect a run, say) can't produce
// `starter_e2e_e2e`.
//
// Deliberately dependency-free and free of any application import, for the
// same reason e2e-preflight.helper.ts is: this file must survive every
// module subtraction without a `// <module:x>` fence.
const E2E_DATABASE_SUFFIX = '_e2e';

export function resolveE2eDatabaseUrl(baseUrl: string): string {
  const url: URL = new URL(baseUrl);
  const name: string = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!name) {
    throw new Error(
      `E2E DATABASE: DATABASE_URL ("${baseUrl}") names no database, so no e2e database can be derived from it.`,
    );
  }

  if (name.endsWith(E2E_DATABASE_SUFFIX)) return url.toString();

  url.pathname = `/${encodeURIComponent(`${name}${E2E_DATABASE_SUFFIX}`)}`;

  return url.toString();
}
