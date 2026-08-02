import type { CacheStoreInterface } from '@providers/cache/interfaces/cache-store.interface.js';
import { CacheService } from '@providers/cache/services/cache.service.js';
import type { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';
import { describe, expect, it, vi } from 'vitest';

class FakeStore implements CacheStoreInterface {
  public readonly entries: Map<string, unknown> = new Map();

  public async get<T>(key: string): Promise<T | null> {
    return (this.entries.get(key) as T) ?? null;
  }

  public async set<T>(key: string, value: T, _ttlMs: number): Promise<void> {
    this.entries.set(key, value);
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

interface TestSetupInterface {
  readonly service: CacheService;
  readonly l1: FakeStore;
  readonly l2: FakeStore;
  readonly publishDelete: ReturnType<typeof vi.fn>;
  readonly publishDeleteByPrefix: ReturnType<typeof vi.fn>;
}

function createService(): TestSetupInterface {
  const l1: FakeStore = new FakeStore();
  const l2: FakeStore = new FakeStore();
  const publishDelete = vi.fn().mockResolvedValue(undefined);
  const publishDeleteByPrefix = vi.fn().mockResolvedValue(undefined);
  const invalidation = {
    publishDelete,
    publishDeleteByPrefix,
  } as unknown as CacheInvalidationService;
  const service: CacheService = new CacheService([l1, l2], invalidation);

  return { service, l1, l2, publishDelete, publishDeleteByPrefix };
}

describe('CacheService', () => {
  it('returns the L2 hit and backfills L1 on wrap', async () => {
    const { service, l1, l2 } = createService();

    await l2.set('user:1', 'cached-value', 1000);

    let factoryCalls = 0;
    const result: string = await service.wrap('user:1', 1000, async (): Promise<string> => {
      factoryCalls += 1;

      return 'fresh-value';
    });

    expect(result).toBe('cached-value');
    expect(factoryCalls).toBe(0);
    expect(l1.entries.get('user:1')).toBe('cached-value');
  });

  it('fans out set and delete to every tier', async () => {
    const { service, l1, l2 } = createService();

    await service.set('key', 42, 1000);

    expect(l1.entries.get('key')).toBe(42);
    expect(l2.entries.get('key')).toBe(42);

    await service.delete('key');

    expect(l1.entries.has('key')).toBe(false);
    expect(l2.entries.has('key')).toBe(false);
  });

  it('publishes invalidation on delete and deleteByPrefix', async () => {
    const { service, publishDelete, publishDeleteByPrefix } = createService();

    await service.set('note:1', 'a', 1000);
    await service.delete('note:1');

    expect(publishDelete).toHaveBeenCalledWith('note:1');

    await service.deleteByPrefix('note:');

    expect(publishDeleteByPrefix).toHaveBeenCalledWith('note:');
  });

  it('fans out deleteByPrefix to every tier', async () => {
    const { service, l1, l2 } = createService();

    await service.set('note:1', 'a', 1000);
    await service.set('note:2', 'b', 1000);
    await service.set('user:1', 'c', 1000);
    await service.deleteByPrefix('note:');

    expect(l1.entries.has('note:1')).toBe(false);
    expect(l2.entries.has('note:2')).toBe(false);
    expect(l2.entries.get('user:1')).toBe('c');
  });

  it('single-flights concurrent wrap calls into one factory execution', async () => {
    const { service } = createService();

    let factoryCalls = 0;
    const factory = async (): Promise<string> => {
      factoryCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));

      return 'value';
    };

    const results: string[] = await Promise.all(
      Array.from({ length: 10 }, (): Promise<string> => service.wrap('hot-key', 1000, factory)),
    );

    expect(factoryCalls).toBe(1);
    expect(results.every((result: string): boolean => result === 'value')).toBe(true);
  });
});
