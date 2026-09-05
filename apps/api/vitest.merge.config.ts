import { defineConfig } from 'vitest/config';
import { coverageConfig } from './vitest.coverage.js';

// Used only by `pnpm run test:cov`, which merges the blob reports the unit and
// e2e runs leave behind and reports coverage over both at once.
//
// WHY THE THRESHOLD LIVES HERE AND NOWHERE ELSE. Measured on the unit run
// alone the figures are statements 75.11, branches 66.49, functions 67.49 —
// and measured across both runs they are 96.03, 84.22 and 98.03. The gap is
// not slack in the suites; it is the e2e specs, which exercise the app over
// real HTTP and contribute nothing to a unit-only report. A gate fed the lower
// number does worse than under-report: it points effort at files that are
// already covered, which is exactly how `auth.service.ts` came to look like
// the least-tested file in the repository while 325 e2e tests ran through it.
//
// Set a couple of points under the measured figures, as a ratchet against
// regression rather than a target. Raise them when the real number rises;
// never lower them to make a red build green.
export default defineConfig({
  test: {
    coverage: {
      ...coverageConfig,
      thresholds: {
        statements: 94,
        branches: 81,
        functions: 96,
        lines: 95,
      },
    },
  },
});
