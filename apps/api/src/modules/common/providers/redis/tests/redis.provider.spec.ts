import type { RedisConfig } from '@configs/redis.config.js';
import { redisProvider } from '@providers/redis/redis.provider.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';

interface FactoryProviderLike {
  readonly useFactory: (config: RedisConfig) => RedisClientType;
}

describe('redisProvider', () => {
  const factory = (redisProvider as unknown as FactoryProviderLike).useFactory;

  it('creates a single-node client when isCluster is false', async () => {
    const config: RedisConfig = { url: 'redis://localhost:6390', isCluster: false };

    const client: RedisClientType = factory(config);

    expect(client).toBeInstanceOf(Redis);
    expect(client).not.toBeInstanceOf(Cluster);
    await client.quit();
  });

  it('creates a cluster client when isCluster is true', async () => {
    const config: RedisConfig = { url: 'redis://localhost:7000', isCluster: true };

    const client: RedisClientType = factory(config);

    expect(client).toBeInstanceOf(Cluster);
    await client.quit();
  });
});
