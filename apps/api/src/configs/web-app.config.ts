import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  baseUrl: z.url(),
});

export type WebAppConfig = Required<z.infer<typeof scheme>>;

export const webAppConfig = registerAs('webApp', (): WebAppConfig => {
  return validateConfigSchema(scheme, {
    baseUrl: process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173',
  });
});
