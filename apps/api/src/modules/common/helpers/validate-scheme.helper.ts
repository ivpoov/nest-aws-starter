import type { Logger } from '@nestjs/common';
import type { z } from 'zod';

export function validateScheme(scheme: z.ZodType, config: unknown, logger: Logger): void {
  const result: z.ZodSafeParseResult<unknown> = scheme.safeParse(config);

  if (!result.success) {
    logger.error(result.error.message);

    throw new Error(`Invalid configuration: ${result.error.message}`);
  }
}
