import { RedisLockService } from '@providers/redis/services/redis-lock.service.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function createService(): {
  service: RedisLockService;
  set: ReturnType<typeof vi.fn>;
  eval: ReturnType<typeof vi.fn>;
} {
  const set = vi.fn();
  const evalFn = vi.fn();
  const redis = { set, eval: evalFn } as unknown as RedisClientType;
  const service: RedisLockService = new RedisLockService(redis);

  return { service, set, eval: evalFn };
}

describe('RedisLockService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('acquires the lock with SET NX PX under a prefixed key', async () => {
    const { service, set } = createService();

    set.mockResolvedValue('OK');

    const token: string | null = await service.acquire('job:demo', 5000);

    expect(token).not.toBeNull();
    expect(set).toHaveBeenCalledWith('lock:job:demo', token, 'PX', 5000, 'NX');
  });

  it('fails to acquire when the key is already held', async () => {
    const { service, set } = createService();

    set.mockResolvedValue(null);

    const token: string | null = await service.acquire('job:demo', 5000);

    expect(token).toBeNull();
  });

  it('withLock runs fn and returns its result when the lock is free', async () => {
    const { service, set, eval: evalFn } = createService();

    set.mockResolvedValue('OK');
    evalFn.mockResolvedValue(1);
    const fn = vi.fn().mockResolvedValue('done');

    const result: string | null = await service.withLock('job:demo', 5000, fn);

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledOnce();
    expect(evalFn).toHaveBeenCalledOnce();
  });

  it('withLock returns null and never runs fn when the lock is held', async () => {
    const { service, set } = createService();

    set.mockResolvedValue(null);
    const fn = vi.fn();

    const result: string | null = await service.withLock('job:demo', 5000, fn);

    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it('withLock releases the lock even when fn throws', async () => {
    const { service, set, eval: evalFn } = createService();

    set.mockResolvedValue('OK');
    evalFn.mockResolvedValue(1);
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(service.withLock('job:demo', 5000, fn)).rejects.toThrow('boom');
    expect(evalFn).toHaveBeenCalledOnce();
  });

  it('release only deletes when the token matches the current owner (compare-and-del)', async () => {
    const { service, eval: evalFn } = createService();

    evalFn.mockResolvedValue(1);

    await service.release('job:demo', 'owner-token');

    expect(evalFn).toHaveBeenCalledWith(expect.any(String), 1, 'lock:job:demo', 'owner-token');
  });

  it('release is a no-op (does not throw) when the token no longer matches', async () => {
    const { service, eval: evalFn } = createService();

    evalFn.mockResolvedValue(0);

    await expect(service.release('job:demo', 'stale-token')).resolves.toBeUndefined();
  });
});
