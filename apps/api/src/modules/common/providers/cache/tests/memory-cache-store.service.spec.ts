import { MemoryCacheStore } from '@providers/cache/services/memory-cache-store.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MemoryCacheStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values within the ttl', async () => {
    const store: MemoryCacheStore = new MemoryCacheStore(10);

    await store.set('key', 'value', 1000);

    expect(await store.get('key')).toBe('value');
  });

  it('expires entries after the ttl', async () => {
    const store: MemoryCacheStore = new MemoryCacheStore(10);

    await store.set('key', 'value', 1000);
    vi.advanceTimersByTime(1001);

    expect(await store.get('key')).toBeNull();
  });

  it('evicts the least recently used entry when full', async () => {
    const store: MemoryCacheStore = new MemoryCacheStore(2);

    await store.set('a', 1, 10_000);
    await store.set('b', 2, 10_000);
    await store.get('a');
    await store.set('c', 3, 10_000);

    expect(await store.get('a')).toBe(1);
    expect(await store.get('b')).toBeNull();
    expect(await store.get('c')).toBe(3);
  });

  it('deletes by prefix', async () => {
    const store: MemoryCacheStore = new MemoryCacheStore(10);

    await store.set('note:1', 'a', 10_000);
    await store.set('user:1', 'b', 10_000);
    await store.deleteByPrefix('note:');

    expect(await store.get('note:1')).toBeNull();
    expect(await store.get('user:1')).toBe('b');
  });
});
