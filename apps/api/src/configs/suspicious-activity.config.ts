import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  newDeviceEmailEnabled: z.boolean(),
});

export type SuspiciousActivityConfig = Required<z.infer<typeof scheme>>;

export const suspiciousActivityConfig = registerAs(
  'suspiciousActivity',
  (): SuspiciousActivityConfig => {
    return validateConfigSchema(scheme, {
      newDeviceEmailEnabled: process.env.NEW_DEVICE_EMAIL_ENABLED === 'true',
    });
  },
);
