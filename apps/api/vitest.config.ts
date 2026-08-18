import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    setupFiles: ['./test/reflect-metadata.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.ts'],
      // Generated Prisma output, the Nest bootstrap and the module wiring are
      // excluded deliberately: none of them are reachable from a unit spec, and
      // leaving them in would depress the number until the threshold measured
      // how much scaffolding exists rather than how much logic is tested.
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
      // Set from the measured numbers at the time of writing — statements
      // 75.11, branches 66.49, functions 67.46, lines 75.32 — minus a couple of
      // points of headroom. This is a ratchet against regression, not a target:
      // it exists so "650+ tests" stops being an unfalsifiable claim and starts
      // being a number CI will defend. Raise it when the real figure rises;
      // never lower it to make a red build green.
      thresholds: {
        statements: 73,
        branches: 64,
        functions: 65,
        lines: 73,
      },
    },
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'nodenext' },
    }),
  ],
});
