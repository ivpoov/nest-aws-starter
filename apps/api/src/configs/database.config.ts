import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  url: z.string().min(1),
});

export type DatabaseConfig = Required<z.infer<typeof scheme>>;

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  return validateConfigSchema(scheme, {
    url: process.env.DATABASE_URL ?? '',
  });
});
