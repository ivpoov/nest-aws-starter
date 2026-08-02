import type { RedisConfig } from '@configs/redis.config.js';
import { CacheInvalidationService } from '@providers/cache/services/cache-invalidation.service.js';
import { MemoryCacheStore } from '@providers/cache/services/memory-cache-store.service.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { describe, expect, it, vi } from 'vitest';

const config: RedisConfig = { url: 'redis://localhost:6390', isCluster: false };

function createService(): { service: CacheInvalidationService; publish: ReturnType<typeof vi.fn> } {
  const publish = vi.fn().mockResolvedValue(1);
  const redis = { publish } as unknown as RedisClientType;
  const service: CacheInvalidationService = new CacheInvalidationService(redis, config);

  return { service, publish };
}

describe('CacheInvalidationService', () => {
  it('publishes delete messages on the invalidation channel', async () => {
    const { service, publish } = createService();

    await service.publishDelete('note:1');

    expect(publish).toHaveBeenCalledOnce();

    const [channel, raw] = publish.mock.calls[0] as [string, string];
    const message: { op: string; target: string; senderId: string } = JSON.parse(raw);

    expect(channel).toBe('cache:invalidation');
    expect(message.op).toBe('delete');
    expect(message.target).toBe('note:1');
    expect(message.senderId).toBeTruthy();
  });

  it('applies foreign invalidations to registered memory stores', async () => {
    const { service } = createService();
    const store: MemoryCacheStore = new MemoryCacheStore(10);

    await store.set('note:1', 'a', 10_000);
    await store.set('note:2', 'b', 10_000);
    service.registerMemoryStore(store);

    await service.handleMessage(
      JSON.stringify({ op: 'delete', target: 'note:1', senderId: 'other-instance' }),
    );
    await service.handleMessage(
      JSON.stringify({ op: 'deleteByPrefix', target: 'note:', senderId: 'other-instance' }),
    );

    expect(await store.get('note:1')).toBeNull();
    expect(await store.get('note:2')).toBeNull();
  });

  it('ignores its own messages', async () => {
    const { service, publish } = createService();
    const store: MemoryCacheStore = new MemoryCacheStore(10);

    await store.set('note:1', 'a', 10_000);
    service.registerMemoryStore(store);

    await service.publishDelete('note:1');

    const [, raw] = publish.mock.calls[0] as [string, string];

    await service.handleMessage(raw);

    expect(await store.get('note:1')).toBe('a');
  });

  it('survives malformed messages', async () => {
    const { service } = createService();

    await expect(service.handleMessage('not-json')).resolves.toBeUndefined();
  });
});
