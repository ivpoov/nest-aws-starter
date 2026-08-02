import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    endpoint: z.url().optional(),
  }),
]);

export type LambdaConfig = z.infer<typeof scheme>;

export const lambdaConfig = registerAs('lambda', (): LambdaConfig => {
  const isEnabled: boolean = process.env.LAMBDA_ENABLED === 'true';

  const config: LambdaConfig = isEnabled
    ? {
        isEnabled: true,
        region: process.env.AWS_REGION ?? '',
        ...(process.env.AWS_ENDPOINT_URL && { endpoint: process.env.AWS_ENDPOINT_URL }),
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new Logger('LambdaConfig'));

  return config;
});
