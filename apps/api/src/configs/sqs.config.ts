import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    endpoint: z.url().optional(),
  }),
]);

export type SqsConfig = z.infer<typeof configSchema>;

export const sqsConfig = registerAs('sqs', (): SqsConfig => {
  const isEnabled: boolean = process.env.SQS_ENABLED === 'true';

  return validateConfigSchema(
    configSchema,
    isEnabled
      ? {
          isEnabled: true,
          region: process.env.AWS_REGION ?? '',
          ...(process.env.AWS_ENDPOINT_URL && { endpoint: process.env.AWS_ENDPOINT_URL }),
        }
      : { isEnabled: false },
  );
});
