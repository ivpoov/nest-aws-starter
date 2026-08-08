import { assertProductionConfig } from '@helpers/assert-production-config.helper.js';
import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  isProduction: z.boolean(),
});

export type ProductionGuardConfig = Required<z.infer<typeof scheme>>;

// Registered last in `configs/index.ts` so the per-provider configs have
// already reported their own problems by the time this one speaks. It reads
// process.env rather than the parsed configs on purpose: the values it judges
// are the raw ones an operator set, and half of them belong to providers that
// may be switched off and therefore never parsed.
export const productionGuardConfig = registerAs('productionGuard', (): ProductionGuardConfig => {
  const logger: Logger = new Logger('ProductionGuardConfig');
  const config: ProductionGuardConfig = { isProduction: process.env.NODE_ENV === 'production' };

  validateScheme(scheme, config, logger);

  if (config.isProduction) assertProductionConfig(process.env, logger);

  return config;
});
