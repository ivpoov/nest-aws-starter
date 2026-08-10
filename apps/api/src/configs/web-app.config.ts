import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  baseUrl: z.url(),
});

export type WebAppConfig = z.infer<typeof configSchema>;

export const webAppConfig = registerAs('webApp', (): WebAppConfig => {
  return validateConfigSchema(configSchema, {
    baseUrl: process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173',
  });
});
