import { Injectable } from '@nestjs/common';
import { CacheService } from '@providers/cache/services/cache.service.js';
import { CacheFactoryService } from '@providers/cache/services/cache-factory.service.js';

// Dashboard aggregates must not hammer TypedSQL per page view — redis-only
// tier (no memory tier: overview/series are admin-only, low QPS, and a
// per-instance L1 would only add staleness variance with no throughput win).
@Injectable()
export class StatisticCacheService {
  private readonly cache: CacheService;

  constructor(cacheFactory: CacheFactoryService) {
    this.cache = cacheFactory.create();
  }

  public wrap<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    return this.cache.wrap(key, ttlMs, factory);
  }
}
