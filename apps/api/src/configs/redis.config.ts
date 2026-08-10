import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  url: z.string().min(1),
  isCluster: z.boolean(),
});

export type RedisConfig = z.infer<typeof configSchema>;

export const redisConfig = registerAs('redis', (): RedisConfig => {
  return validateConfigSchema(configSchema, {
    url: process.env.REDIS_URL ?? 'redis://localhost:6390',
    isCluster: process.env.REDIS_IS_CLUSTER === 'true',
  });
});
