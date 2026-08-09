import { assertProductionConfig } from '@helpers/assert-production-config.helper.js';
import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  isProduction: z.boolean(),
});

export type ProductionGuardConfig = z.infer<typeof configSchema>;

// Registered last in `configs/index.ts` so the per-provider configs have
// already reported their own problems by the time this one speaks. It reads
// process.env rather than the parsed configs on purpose: the values it judges
// are the raw ones an operator set, and half of them belong to providers that
// may be switched off and therefore never parsed.
export const productionGuardConfig = registerAs('productionGuard', (): ProductionGuardConfig => {
  const config: ProductionGuardConfig = validateConfigSchema(configSchema, {
    isProduction: process.env.NODE_ENV === 'production',
  });

  if (config.isProduction) assertProductionConfig(process.env, new Logger('ProductionBootGuard'));

  return config;
});
