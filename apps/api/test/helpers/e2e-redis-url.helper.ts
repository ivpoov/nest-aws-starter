// Postgres is not the only store the suite writes to: refresh tokens,
// throttle counters, lockout state and every cached list land in Redis, on
// the same instance the dev app uses. Two consequences, both real — a
// throttle counter left over from the previous run changes what the next run
// observes (the repeatability property this whole change exists to
// establish), and a list cached while the suite's users existed can still be
// served to the dev app after those users are gone.
//
// Fixed by moving the suite onto its own Redis logical database (index 1)
// rather than sharing index 0 with the dev app, mirroring how
// e2e-database-url.helper.ts moves it onto its own Postgres database. Redis
// ships with 16 logical databases by default, so nothing has to be
// configured for this to work.
//
// Redis Cluster has no logical databases (only index 0 exists), so a cluster
// URL is returned untouched and e2e-isolation.helper.ts skips the flush that
// would otherwise clear shared keys.
const E2E_REDIS_DATABASE_INDEX = '1';

export function resolveE2eRedisUrl(baseUrl: string, isCluster: boolean): string {
  if (isCluster) return baseUrl;

  const url: URL = new URL(baseUrl);

  url.pathname = `/${E2E_REDIS_DATABASE_INDEX}`;

  return url.toString();
}
