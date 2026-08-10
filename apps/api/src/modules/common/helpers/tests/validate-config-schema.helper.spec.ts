import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const schema = z.object({ port: z.number() });

// The signature type-checks the literal a config factory passes in, so an
// invalid value has to be smuggled past the compiler to reach the runtime
// gate this suite is about.
const invalid = { port: 'oops' } as unknown as z.input<typeof schema>;

describe('validateConfigSchema', () => {
  it('throws when the value does not match the schema', () => {
    expect(() => validateConfigSchema(schema, invalid)).toThrow(/Invalid configuration/);
  });

  // The dropped logger call was the only place the offending field was
  // named — the thrown message has to carry it, or a boot failure says
  // nothing about which variable to fix.
  it('names the offending field in the thrown message', () => {
    expect(() => validateConfigSchema(schema, invalid)).toThrow(/port/);
  });

  it('returns the parsed value on valid config', () => {
    expect(validateConfigSchema(schema, { port: 3000 })).toEqual({ port: 3000 });
  });
});
