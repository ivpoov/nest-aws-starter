import { Inject, Injectable } from '@nestjs/common';
import type { CacheStoreInterface } from '@providers/cache/interfaces/cache-store.interface.js';
import type { CreateCacheOptionsInterface } from '@providers/cache/interfaces/create-cache-options.interface.js';
import { CacheService } from '@providers/cache/services/cache.service.js';
import { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';
import { MemoryCacheStore } from '@providers/cache/services/memory-cache-store.service.js';
import { RedisCacheStore } from '@providers/cache/services/redis-cache-store.service.js';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

const DEFAULT_MEMORY_MAX_ENTRIES = 1000;

@Injectable()
export class CacheFactoryService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    private readonly invalidation: CacheInvalidationService,
  ) {}

  // Each consumer composes its own cache (e.g. a UsersCacheService calls
  // create({ isMemoryEnabled: true }) for a hot path) — the memory tier is a
  // per-call-site decision, never a global one. Memory stores are registered for
  // cross-instance pub/sub invalidation.
  public create(options: CreateCacheOptionsInterface = {}): CacheService {
    const stores: CacheStoreInterface[] = [];

    if (options.isMemoryEnabled) {
      const memoryStore: MemoryCacheStore = new MemoryCacheStore(
        options.memoryMaxEntries ?? DEFAULT_MEMORY_MAX_ENTRIES,
      );

      this.invalidation.registerMemoryStore(memoryStore);
      stores.push(memoryStore);
    }

    stores.push(new RedisCacheStore(this.redis));

    return new CacheService(stores, this.invalidation);
  }
}
