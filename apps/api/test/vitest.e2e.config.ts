import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
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
    },
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'nodenext' },
    }),
  ],
});
