import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    fromAddress: z.email(),
    endpoint: z.url().optional(),
  }),
]);

export type MailConfig = z.infer<typeof configSchema>;

export const mailConfig = registerAs('mail', (): MailConfig => {
  const isEnabled: boolean = process.env.MAIL_ENABLED === 'true';

  return validateConfigSchema(
    configSchema,
    isEnabled
      ? {
          isEnabled: true,
          region: process.env.AWS_REGION ?? '',
          fromAddress: process.env.MAIL_FROM_ADDRESS ?? '',
          ...(process.env.AWS_ENDPOINT_URL && { endpoint: process.env.AWS_ENDPOINT_URL }),
        }
      : { isEnabled: false },
  );
});
