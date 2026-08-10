import type { z } from 'zod';

// Parses a config factory's raw shape and hands back the *parsed* value, so a
// factory's return statement and its validation are the same expression —
// there is no window in which an unvalidated object is already in hand. The
// throw is the whole error channel: config factories run during
// `ConfigModule.forRoot()`, long before a logger transport exists, and Nest
// prints the boot failure with the Zod issue list attached.
export function validateConfigSchema<TSchema extends z.ZodType>(
  schema: TSchema,
  value: z.input<TSchema>,
): z.output<TSchema> {
  const result: z.ZodSafeParseResult<z.output<TSchema>> = schema.safeParse(value);

  if (!result.success) {
    throw new Error(`Invalid configuration: ${result.error.message}`);
  }

  return result.data;
}
