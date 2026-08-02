import { type RedisConfig, redisConfig } from '@configs/redis.config.js';
import type { Provider } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, Redis } from 'ioredis';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [redisConfig.KEY],
  useFactory: (config: RedisConfig): RedisClientType =>
    config.isCluster
      ? new Cluster([config.url], { lazyConnect: true })
      : new Redis(config.url, { lazyConnect: true }),
};
