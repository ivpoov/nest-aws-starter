import type { RedisConfig } from '@configs/redis.config.js';
import { createRedisClient } from '@providers/redis/helpers/create-redis-client.helper.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, Redis, type RedisOptions } from 'ioredis';
import { describe, expect, it } from 'vitest';

function clusterOptionsOf(client: RedisClientType): RedisOptions {
  return (client as Cluster).options.redisOptions ?? {};
}

describe('createRedisClient', () => {
  it('creates a single-node client when isCluster is false', async () => {
    const config: RedisConfig = { url: 'redis://localhost:6390', isCluster: false };

    const client: RedisClientType = createRedisClient(config);

    expect(client).toBeInstanceOf(Redis);
    expect(client).not.toBeInstanceOf(Cluster);
    await client.quit();
  });

  it('creates a cluster client when isCluster is true', async () => {
    const config: RedisConfig = { url: 'redis://localhost:7000', isCluster: true };

    const client: RedisClientType = createRedisClient(config);

    expect(client).toBeInstanceOf(Cluster);
    await client.quit();
  });

  // ioredis reads `rediss://` in the standalone constructor only. Left to the
  // cluster path, the TLS-enabled managed cache this repository's own Terraform
  // provisions would be reached in plaintext.
  it('carries a rediss:// scheme into the options every discovered node inherits', async () => {
    const config: RedisConfig = { url: 'rediss://cache.example.com:6379', isCluster: true };

    const client: RedisClientType = createRedisClient(config);

    expect(clusterOptionsOf(client).tls).toEqual({});
    await client.quit();
  });

  // Nodes discovered from CLUSTER SLOTS are rebuilt as bare host/port, so
  // credentials that live only on the seed URL produce NOAUTH everywhere else.
  it('carries url credentials into the options every discovered node inherits', async () => {
    const config: RedisConfig = {
      url: 'redis://admin:p%40ss@cache.example.com:6379',
      isCluster: true,
    };

    const client: RedisClientType = createRedisClient(config);
    const options: RedisOptions = clusterOptionsOf(client);

    expect(options.username).toBe('admin');
    expect(options.password).toBe('p@ss');
    await client.quit();
  });

  it('leaves tls and credentials unset for a plain redis:// cluster url', async () => {
    const config: RedisConfig = { url: 'redis://localhost:7000', isCluster: true };

    const client: RedisClientType = createRedisClient(config);
    const options: RedisOptions = clusterOptionsOf(client);

    expect(options.tls).toBeUndefined();
    expect(options.username).toBeUndefined();
    expect(options.password).toBeUndefined();
    await client.quit();
  });
});
