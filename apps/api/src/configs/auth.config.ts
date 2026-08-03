import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  jwtSecret: z.string().min(32),
  accessTtlSec: z.number().int().positive(),
  refreshTtlSec: z.number().int().positive(),
  refreshGraceSec: z.number().int().positive(),
});

export type AuthConfig = Required<z.infer<typeof scheme>>;

export const authConfig = registerAs('auth', (): AuthConfig => {
  const config: AuthConfig = {
    jwtSecret: process.env.AUTH_JWT_SECRET ?? '',
    accessTtlSec: Number(process.env.AUTH_ACCESS_TTL_SEC ?? 900),
    refreshTtlSec: Number(process.env.AUTH_REFRESH_TTL_SEC ?? 2_592_000),
    refreshGraceSec: Number(process.env.AUTH_REFRESH_GRACE_SEC ?? 30),
  };

  validateScheme(scheme, config, new Logger('AuthConfig'));

  return config;
});
