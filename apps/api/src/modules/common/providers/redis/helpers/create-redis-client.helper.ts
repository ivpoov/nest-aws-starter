import type { RedisConfig } from '@configs/redis.config.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, Redis, type RedisOptions } from 'ioredis';

// One construction site for both modes, because the cluster branch needs work
// the single-node branch does not and every caller was getting it wrong.
//
// `new Cluster([url])` does parse the seed URL, but ioredis applies the result
// to the SEED connection only: nodes discovered from CLUSTER SLOTS are rebuilt
// as bare host/port and merged with `redisOptions` alone. And ioredis's
// `rediss://` -> TLS branch lives in the standalone `Redis` constructor; the
// cluster path never looks at the scheme at all.
//
// So `new Cluster(['rediss://user:pass@host'])` connected in PLAINTEXT and
// answered `NOAUTH` on every node but the seed — and `rediss://` is exactly
// what this repository's own Terraform hands the application for a managed
// cache (`infra/terraform/datastores.tf`, `cache_url`). Lifting the scheme and
// the credentials into `redisOptions` is what makes the two modes actually
// interchangeable, which is the whole premise of the provider.
export function createRedisClient(config: RedisConfig): RedisClientType {
  if (!config.isCluster) return new Redis(config.url, { lazyConnect: true });

  const url: URL = new URL(config.url);
  const redisOptions: RedisOptions = {};

  if (url.protocol === 'rediss:') redisOptions.tls = {};
  if (url.username !== '') redisOptions.username = decodeURIComponent(url.username);
  if (url.password !== '') redisOptions.password = decodeURIComponent(url.password);

  return new Cluster([config.url], { lazyConnect: true, redisOptions });
}
