import { describe, expect, it } from 'vitest';

interface ErrorArgsLikeInterface {
  readonly code: string;
  readonly details: string;
}

function isErrorArgs(value: unknown): value is ErrorArgsLikeInterface {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorArgsLikeInterface).code === 'string' &&
    typeof (value as ErrorArgsLikeInterface).details === 'string'
  );
}

// Every module's error constants file is collected here; this spec IS the registry —
// it replaces central number allocation with an automated uniqueness guarantee.
const modules: Record<string, Record<string, unknown>> = import.meta.glob(
  '../../../**/constants/*errors.constants.ts',
  { eager: true },
) as Record<string, Record<string, unknown>>;

describe('error codes', () => {
  it('finds at least one error constants file', () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });

  it('codes equal their exported constant names', () => {
    for (const [path, exports] of Object.entries(modules)) {
      for (const [exportName, value] of Object.entries(exports)) {
        if (!isErrorArgs(value)) continue;

        expect(value.code, `${exportName} in ${path}`).toBe(exportName);
      }
    }
  });

  it('codes are globally unique', () => {
    const seen: Map<string, string> = new Map();

    for (const [path, exports] of Object.entries(modules)) {
      for (const value of Object.values(exports)) {
        if (!isErrorArgs(value)) continue;

        const existing: string | undefined = seen.get(value.code);

        expect(existing, `duplicate code ${value.code} in ${path} and ${existing}`).toBeUndefined();
        seen.set(value.code, path);
      }
    }
  });
});
