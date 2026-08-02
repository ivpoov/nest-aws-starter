import type { CacheStoreInterface } from '@providers/cache/interfaces/cache-store.interface.js';
import type { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';

export class CacheService {
  private readonly inFlight: Map<string, Promise<unknown>> = new Map();

  constructor(
    private readonly stores: CacheStoreInterface[],
    private readonly invalidation: CacheInvalidationService,
  ) {}

  public async get<T>(key: string): Promise<T | null> {
    for (const store of this.stores) {
      const value: T | null = await store.get<T>(key);

      if (value !== null) return value;
    }

    return null;
  }

  public async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await Promise.all(
      this.stores.map((store: CacheStoreInterface): Promise<void> => store.set(key, value, ttlMs)),
    );
  }

  public async delete(key: string): Promise<void> {
    await Promise.all(
      this.stores.map((store: CacheStoreInterface): Promise<void> => store.delete(key)),
    );
    await this.invalidation.publishDelete(key);
  }

  public async deleteByPrefix(prefix: string): Promise<void> {
    await Promise.all(
      this.stores.map((store: CacheStoreInterface): Promise<void> => store.deleteByPrefix(prefix)),
    );
    await this.invalidation.publishDeleteByPrefix(prefix);
  }

  // Caveats:
  // - `null` is indistinguishable from a miss — a factory returning null runs on
  //   every call. Never cache legitimate null; wrap it in an object if needed.
  // - a lower-tier hit backfills upper tiers with the FULL ttlMs again, so the
  //   worst-case staleness bound is 2× the L1 TTL — keep L1 TTLs in seconds.
  public async wrap<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const cached: T | null = await this.getWithBackfill<T>(key, ttlMs);

    if (cached !== null) return cached;

    return this.singleFlight<T>(key, async (): Promise<T> => {
      const value: T = await factory();

      await this.set(key, value, ttlMs);

      return value;
    });
  }

  private async getWithBackfill<T>(key: string, ttlMs: number): Promise<T | null> {
    for (let index = 0; index < this.stores.length; index += 1) {
      const value: T | null | undefined = await this.stores[index]?.get<T>(key);

      if (value !== null && value !== undefined) {
        const missedTiers: CacheStoreInterface[] = this.stores.slice(0, index);

        await Promise.all(
          missedTiers.map(
            (tier: CacheStoreInterface): Promise<void> => tier.set(key, value, ttlMs),
          ),
        );

        return value;
      }
    }

    return null;
  }

  private singleFlight<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing: Promise<unknown> | undefined = this.inFlight.get(key);

    if (existing) return existing as Promise<T>;

    const promise: Promise<T> = operation().finally((): void => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);

    return promise;
  }
}
