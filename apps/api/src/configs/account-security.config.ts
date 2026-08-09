import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  newDeviceEmailEnabled: z.boolean(),
});

export type AccountSecurityConfig = z.infer<typeof configSchema>;

export const accountSecurityConfig = registerAs('accountSecurity', (): AccountSecurityConfig => {
  return validateConfigSchema(configSchema, {
    newDeviceEmailEnabled: process.env.NEW_DEVICE_EMAIL_ENABLED === 'true',
  });
});
