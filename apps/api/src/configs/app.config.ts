import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  port: z.number(),
  env: z.enum(['development', 'test', 'production']),
  apiPrefix: z.string(),
});

export type AppConfig = Required<z.infer<typeof scheme>>;

export const appConfig = registerAs('app', (): AppConfig => {
  const config: AppConfig = {
    port: Number(process.env.PORT ?? 3000),
    env: (process.env.NODE_ENV ?? 'development') as AppConfig['env'],
    apiPrefix: process.env.API_PREFIX ?? 'api',
  };

  validateScheme(scheme, config, new Logger('AppConfig'));

  return config;
});
