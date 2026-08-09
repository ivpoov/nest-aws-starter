import type { CacheStoreInterface } from '@providers/cache/interfaces/cache-store.interface.js';
import type { MemoryCacheEntryInterface } from '@providers/cache/interfaces/memory-cache-entry.interface.js';

export class MemoryCacheStore implements CacheStoreInterface {
  private readonly entries: Map<string, MemoryCacheEntryInterface> = new Map();

  constructor(private readonly maxEntries: number) {}

  public async get<T>(key: string): Promise<T | null> {
    const entry: MemoryCacheEntryInterface | undefined = this.entries.get(key);

    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);

      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.value as T;
  }

  public async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.entries.delete(key);

    // `get` re-inserts on every hit, so Map iteration order is the recency
    // order and its head is the least recently used entry.
    if (this.entries.size >= this.maxEntries) {
      const leastRecentlyUsed: string | undefined = this.entries.keys().next().value;

      if (leastRecentlyUsed !== undefined) this.entries.delete(leastRecentlyUsed);
    }

    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  public async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  public async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
  }
}
