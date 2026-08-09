import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  url: z.string().min(1),
});

export type DatabaseConfig = z.infer<typeof configSchema>;

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  return validateConfigSchema(configSchema, {
    url: process.env.DATABASE_URL ?? '',
  });
});
