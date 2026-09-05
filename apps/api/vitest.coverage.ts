import type { CoverageV8Options } from 'vitest/node';

// Shared by three configs — the unit run, the e2e run, and the merge that
// combines them. It lives in one file because the include/exclude decide the
// DENOMINATOR: two runs measuring different file sets cannot be merged into a
// number that means anything, and the drift would be invisible in both.
//
// Generated Prisma output, the Nest bootstrap and the module wiring are
// excluded deliberately. None of them is reachable from a spec, and leaving
// them in would make the figure measure how much scaffolding exists rather
// than how much logic is tested.
export const coverageConfig: CoverageV8Options = {
  provider: 'v8',
  reporter: ['text-summary', 'lcov'],
  include: ['src/**/*.ts'],
  exclude: [
    'src/generated/**',
    'src/main.ts',
    'src/**/*.module.ts',
    'src/**/tests/**',
    'src/**/interfaces/**',
    'src/**/types/**',
    'src/**/enums/**',
    'src/**/constants/**',
    'src/**/dtos/**',
  ],
};
