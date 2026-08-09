import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  port: z.number(),
  env: z.enum(['development', 'test', 'production']),
  apiPrefix: z.string(),
  trustProxy: z.boolean(),
  corsOrigins: z.array(z.url()),
});

export type AppConfig = z.infer<typeof configSchema>;

export const appConfig = registerAs('app', (): AppConfig => {
  return validateConfigSchema(configSchema, {
    port: Number(process.env.PORT ?? 3000),
    env: (process.env.NODE_ENV ?? 'development') as AppConfig['env'],
    apiPrefix: process.env.API_PREFIX ?? 'api',
    trustProxy: process.env.TRUST_PROXY === 'true',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((origin: string): string => origin.trim())
      .filter((origin: string): boolean => origin.length > 0),
  });
});
