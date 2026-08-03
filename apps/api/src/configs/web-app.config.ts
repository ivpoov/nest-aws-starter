import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  baseUrl: z.url(),
});

export type WebAppConfig = Required<z.infer<typeof scheme>>;

export const webAppConfig = registerAs('webApp', (): WebAppConfig => {
  const config: WebAppConfig = {
    baseUrl: process.env.WEB_APP_BASE_URL ?? 'http://localhost:5173',
  };

  validateScheme(scheme, config, new Logger('WebAppConfig'));

  return config;
});
