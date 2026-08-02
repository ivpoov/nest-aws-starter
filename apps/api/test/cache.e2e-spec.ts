import type { RedisConfig } from '@configs/redis.config.js';
import { CacheService } from '@providers/cache/services/cache.service.js';
import { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';
import { MemoryCacheStore } from '@providers/cache/services/memory-cache-store.service.js';
import { RedisCacheStore } from '@providers/cache/services/redis-cache-store.service.js';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const redisUrl: string = process.env.REDIS_URL ?? 'redis://localhost:6390';
const config: RedisConfig = { url: redisUrl, isCluster: false };

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('RedisCacheStore (integration)', () => {
  let redis: Redis;
  let store: RedisCacheStore;

  beforeAll(() => {
    redis = new Redis(redisUrl);
    store = new RedisCacheStore(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it('round-trips json values with a ttl', async () => {
    await store.set('cache-e2e:item', { count: 3 }, 5000);

    const value: { count: number } | null = await store.get('cache-e2e:item');

    expect(value).toEqual({ count: 3 });

    const ttlMs: number = await redis.pttl('cache-e2e:item');

    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(5000);
  });

  it('deletes by prefix without touching other keys', async () => {
    await store.set('cache-e2e:note:1', 'a', 5000);
    await store.set('cache-e2e:note:2', 'b', 5000);
    await store.set('cache-e2e:user:1', 'c', 5000);
    await store.deleteByPrefix('cache-e2e:note:');

    expect(await store.get('cache-e2e:note:1')).toBeNull();
    expect(await store.get('cache-e2e:note:2')).toBeNull();
    expect(await store.get('cache-e2e:user:1')).toBe('c');

    await store.deleteByPrefix('cache-e2e:');
  });
});

describe('cross-instance invalidation (integration)', () => {
  let redisA: Redis;
  let redisB: Redis;
  let invalidationA: CacheInvalidationService;
  let invalidationB: CacheInvalidationService;
  let memoryB: MemoryCacheStore;
  let cacheA: CacheService;
  let cacheB: CacheService;

  beforeAll(async () => {
    redisA = new Redis(redisUrl);
    redisB = new Redis(redisUrl);
    invalidationA = new CacheInvalidationService(redisA, config);
    invalidationB = new CacheInvalidationService(redisB, config);
    await invalidationA.onModuleInit();
    await invalidationB.onModuleInit();

    memoryB = new MemoryCacheStore(100);
    invalidationB.registerMemoryStore(memoryB);

    cacheA = new CacheService([new RedisCacheStore(redisA)], invalidationA);
    cacheB = new CacheService([memoryB, new RedisCacheStore(redisB)], invalidationB);
  });

  afterAll(async () => {
    await invalidationA.onModuleDestroy();
    await invalidationB.onModuleDestroy();
    await redisA.quit();
    await redisB.quit();
  });

  it("delete on one instance clears the other instance's memory tier", async () => {
    await cacheB.set('inv-e2e:user:1', 'profile', 10_000);

    expect(await memoryB.get('inv-e2e:user:1')).toBe('profile');

    await cacheA.delete('inv-e2e:user:1');
    await waitFor(200);

    expect(await memoryB.get('inv-e2e:user:1')).toBeNull();
    expect(await cacheB.get('inv-e2e:user:1')).toBeNull();
  });

  it("deleteByPrefix on one instance clears the other instance's memory tier", async () => {
    await cacheB.set('inv-e2e:note:1', 'a', 10_000);
    await cacheB.set('inv-e2e:note:2', 'b', 10_000);

    await cacheA.deleteByPrefix('inv-e2e:note:');
    await waitFor(200);

    expect(await memoryB.get('inv-e2e:note:1')).toBeNull();
    expect(await memoryB.get('inv-e2e:note:2')).toBeNull();
    expect(await cacheB.get('inv-e2e:note:1')).toBeNull();
  });
});
