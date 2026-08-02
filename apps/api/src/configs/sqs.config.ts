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

export type SqsConfig = z.infer<typeof scheme>;

export const sqsConfig = registerAs('sqs', (): SqsConfig => {
  const isEnabled: boolean = process.env.SQS_ENABLED === 'true';

  const config: SqsConfig = isEnabled
    ? {
        isEnabled: true,
        region: process.env.AWS_REGION ?? '',
        ...(process.env.AWS_ENDPOINT_URL && { endpoint: process.env.AWS_ENDPOINT_URL }),
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new Logger('SqsConfig'));

  return config;
});
