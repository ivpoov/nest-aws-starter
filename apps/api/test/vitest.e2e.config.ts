import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

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
    globalSetup: ['./test/helpers/e2e-preflight.helper.ts'],
    // Pinned here (not just in CI) so a clean clone running
    // `cp .env.example .env && pnpm test:e2e` never runs cron jobs or the
    // webhook consumer's long-poll loop mid-suite — both would otherwise
    // default to enabled and add noise/races to unrelated specs. dotenv
    // (loaded by ConfigModule.forRoot inside the app) never overrides an
    // already-set process.env variable, so this wins regardless of what a
    // local .env contains.
    env: {
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
