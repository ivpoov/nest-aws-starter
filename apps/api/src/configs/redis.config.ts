import { validateScheme } from '@helpers/validate-scheme.helper.js';
import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const scheme = z.object({
  url: z.string().min(1),
  isCluster: z.boolean(),
});

export type RedisConfig = Required<z.infer<typeof scheme>>;

export const redisConfig = registerAs('redis', (): RedisConfig => {
  const config: RedisConfig = {
    url: process.env.REDIS_URL ?? 'redis://localhost:6390',
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  };

  validateScheme(scheme, config, new Logger('RedisConfig'));

  return config;
});
