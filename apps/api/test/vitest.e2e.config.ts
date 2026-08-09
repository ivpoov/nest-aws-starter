import { config as loadEnv } from 'dotenv';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import { resolveE2eDatabaseUrl } from './helpers/e2e-database-url.helper.js';
import { resolveE2eRedisUrl } from './helpers/e2e-redis-url.helper.js';

// Read before the `env` block below computes anything from it: this config
// is evaluated in vitest's main process, where nothing has loaded
// apps/api/.env yet. Same non-overriding semantics everywhere else in the
// suite relies on — CI's job-level `env:` still wins.
loadEnv();

const DEV_DATABASE_URL: string =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/starter';
const DEV_REDIS_URL: string = process.env.REDIS_URL ?? 'redis://localhost:6390';
const IS_REDIS_CLUSTER: boolean = process.env.REDIS_IS_CLUSTER === 'true';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['./test/reflect-metadata.setup.ts'],
    hookTimeout: 30000,
    testTimeout: 30000,
    // Runs once before any spec (not per-spec, unlike app.factory.ts) and
    // fails the whole run with an actionable message if LocalStack is down
    // or stale — see the file's own header for the incident history this
    // closes.
    // Order matters only in that both run once, before any spec:
    // e2e-preflight fails fast on a stale LocalStack, e2e-isolation creates,
    // migrates and empties the suite's own Postgres database and Redis
    // logical database (and empties them again on the way out). See
    // e2e-isolation.helper.ts's header for why isolation, not per-spec
    // teardown, is what this suite needs.
    globalSetup: [
      './test/helpers/e2e-preflight.helper.ts',
      './test/helpers/e2e-isolation.helper.ts',
    ],
    // Pinned here (not just in CI) so a clean clone running
    // `cp .env.example .env && pnpm test:e2e` never runs cron jobs or the
    // webhook consumer's long-poll loop mid-suite — both would otherwise
    // default to enabled and add noise/races to unrelated specs. dotenv
    // (loaded by ConfigModule.forRoot inside the app) never overrides an
    // already-set process.env variable, so this wins regardless of what a
    // local .env contains.
    env: {
      // The suite never runs against the database or the Redis logical
      // database a developer's app uses — see e2e-database-url.helper.ts.
      // Set here rather than in globalSetup because `env` is what vitest
      // applies inside each worker before a spec imports anything, which is
      // also what carries the right DATABASE_URL into the `prisma db seed`
      // subprocess seed-guard.e2e-spec.ts spawns.
      DATABASE_URL: resolveE2eDatabaseUrl(DEV_DATABASE_URL),
      REDIS_URL: resolveE2eRedisUrl(DEV_REDIS_URL, IS_REDIS_CLUSTER),
      SCHEDULER_ENABLED: 'false',
      PAYMENT_WEBHOOK_CONSUMER_ENABLED: 'false',
      // The notification gateway must stay enabled here — it's what
      // websocket.e2e-spec.ts exercises. Its heartbeat sweep is dropped to
      // 200ms (vs. the 60s default) purely so the revocation case doesn't
      // wait a full minute; every other e2e suite that never opens a
      // socket pays nothing extra (the sweep iterates zero tracked
      // sockets and no-ops).
      WEBSOCKET_ENABLED: 'true',
      WEBSOCKET_HEARTBEAT_INTERVAL_MS: '200',
    },
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'nodenext' },
    }),
  ],
});
