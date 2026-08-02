import { CacheService } from '@providers/cache/services/cache.service.js';
import { CacheFactoryService } from '@providers/cache/services/cache-factory.service.js';
import type { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { describe, expect, it, vi } from 'vitest';

function createFactory(): {
  factory: CacheFactoryService;
  registerMemoryStore: ReturnType<typeof vi.fn>;
} {
  const registerMemoryStore = vi.fn();
  const invalidation = { registerMemoryStore } as unknown as CacheInvalidationService;
  const redis = {} as RedisClientType;
  const factory: CacheFactoryService = new CacheFactoryService(redis, invalidation);

  return { factory, registerMemoryStore };
}

describe('CacheFactoryService', () => {
  it('creates a redis-only cache by default', () => {
    const { factory, registerMemoryStore } = createFactory();

    const cache: CacheService = factory.create();

    expect(cache).toBeInstanceOf(CacheService);
    expect(registerMemoryStore).not.toHaveBeenCalled();
  });

  it('registers the memory tier for invalidation when enabled', () => {
    const { factory, registerMemoryStore } = createFactory();

    factory.create({ isMemoryEnabled: true, memoryMaxEntries: 5 });

    expect(registerMemoryStore).toHaveBeenCalledOnce();
  });
});
