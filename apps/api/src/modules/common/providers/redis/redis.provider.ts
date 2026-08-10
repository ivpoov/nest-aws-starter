import { type RedisConfig, redisConfig } from '@configs/redis.config.js';
import type { Provider } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import { createRedisClient } from '@providers/redis/helpers/create-redis-client.helper.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [redisConfig.KEY],
  useFactory: (config: RedisConfig): RedisClientType => createRedisClient(config),
};
