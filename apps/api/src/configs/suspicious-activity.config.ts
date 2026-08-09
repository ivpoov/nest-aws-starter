import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  newDeviceEmailEnabled: z.boolean(),
});

export type SuspiciousActivityConfig = z.infer<typeof configSchema>;

export const suspiciousActivityConfig = registerAs(
  'suspiciousActivity',
  (): SuspiciousActivityConfig => {
    return validateConfigSchema(configSchema, {
      newDeviceEmailEnabled: process.env.NEW_DEVICE_EMAIL_ENABLED === 'true',
    });
  },
);
