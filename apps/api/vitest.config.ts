import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import { coverageConfig } from './vitest.coverage.js';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['./test/reflect-metadata.setup.ts'],
    // Unit-run coverage carries NO thresholds. On its own it measures barely
    // three quarters of what the suites actually reach, because the e2e specs
    // drive the app over real HTTP and contribute nothing to this run. Gating
    // on that number is how `auth.service.ts` came to read 48.9% while being
    // exercised by 325 e2e tests. The threshold lives on the merged report
    // (vitest.merge.config.ts), which is the only figure that means anything.
    coverage: coverageConfig,
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'nodenext' },
    }),
  ],
});
