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

export type SnsConfig = z.infer<typeof configSchema>;

export const snsConfig = registerAs('sns', (): SnsConfig => {
  const isEnabled: boolean = process.env.SNS_ENABLED === 'true';

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
