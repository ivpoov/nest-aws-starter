import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  newDeviceEmailEnabled: z.boolean(),
});

export type SuspiciousActivityConfig = Required<z.infer<typeof scheme>>;

export const suspiciousActivityConfig = registerAs(
  'suspiciousActivity',
  (): SuspiciousActivityConfig => {
    const config: SuspiciousActivityConfig = {
      newDeviceEmailEnabled: process.env.NEW_DEVICE_EMAIL_ENABLED === 'true',
    };

    validateScheme(scheme, config, new Logger('SuspiciousActivityConfig'));

    return config;
  },
);
