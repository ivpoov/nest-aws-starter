import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  url: z.string().min(1),
});

export type DatabaseConfig = Required<z.infer<typeof scheme>>;

export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const config: DatabaseConfig = {
    url: process.env.DATABASE_URL ?? '',
  };

  validateScheme(scheme, config, new Logger('DatabaseConfig'));

  return config;
});
