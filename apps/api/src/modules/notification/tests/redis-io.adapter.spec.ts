import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RedisIoAdapter } from '@modules/notification/adapters/redis-io.adapter.js';
import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeRedisClient {
  readonly connect: ReturnType<typeof vi.fn>;
  readonly quit: ReturnType<typeof vi.fn>;
}

function createDuplicate(): FakeRedisClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  };
}

function createApp(pub: FakeRedisClient, sub: FakeRedisClient): INestApplicationContext {
  const duplicate = vi.fn().mockReturnValueOnce(pub).mockReturnValueOnce(sub);

  return { get: vi.fn().mockReturnValue({ duplicate }) } as unknown as INestApplicationContext;
}

describe('RedisIoAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('duplicates and connects a pub and a sub client from REDIS_CLIENT', async () => {
    const pub: FakeRedisClient = createDuplicate();
    const sub: FakeRedisClient = createDuplicate();
    const adapter: RedisIoAdapter = new RedisIoAdapter(createApp(pub, sub));

    await adapter.connectToRedis();

    expect(pub.connect).toHaveBeenCalledOnce();
    expect(sub.connect).toHaveBeenCalledOnce();
  });

  it('attaches the Redis adapter constructor to every server it creates once connected', async () => {
    const server = { adapter: vi.fn() };

    vi.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(server);

    const adapter: RedisIoAdapter = new RedisIoAdapter(
      createApp(createDuplicate(), createDuplicate()),
    );

    await adapter.connectToRedis();
    const result = adapter.createIOServer(0);

    expect(result).toBe(server);
    expect(server.adapter).toHaveBeenCalledExactlyOnceWith(expect.any(Function));
  });

  it('creates a server without attaching an adapter when Redis was never connected', () => {
    const server = { adapter: vi.fn() };

    vi.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(server);

    const adapter: RedisIoAdapter = new RedisIoAdapter(
      createApp(createDuplicate(), createDuplicate()),
    );

    adapter.createIOServer(0);

    expect(server.adapter).not.toHaveBeenCalled();
  });

  it('closes the io server then quits both duplicated Redis clients', async () => {
    const pub: FakeRedisClient = createDuplicate();
    const sub: FakeRedisClient = createDuplicate();
    const server = { close: vi.fn((cb: () => void) => cb()) };

    vi.spyOn(IoAdapter.prototype, 'close');

    const adapter: RedisIoAdapter = new RedisIoAdapter(createApp(pub, sub));

    await adapter.connectToRedis();
    await adapter.close(server as unknown as Parameters<RedisIoAdapter['close']>[0]);

    expect(IoAdapter.prototype.close).toHaveBeenCalledWith(server);
    expect(pub.quit).toHaveBeenCalledOnce();
    expect(sub.quit).toHaveBeenCalledOnce();
  });

  it('logs a warning instead of throwing when quitting a duplicated client fails', async () => {
    const pub: FakeRedisClient = createDuplicate();
    const sub: FakeRedisClient = createDuplicate();

    pub.quit.mockRejectedValue(new Error('connection already closed'));
    vi.spyOn(IoAdapter.prototype, 'close').mockResolvedValue(undefined);

    const warnSpy = vi.spyOn(CustomLoggerService.prototype, 'warn').mockImplementation(() => {});
    const adapter: RedisIoAdapter = new RedisIoAdapter(createApp(pub, sub));

    await adapter.connectToRedis();

    await expect(
      adapter.close({} as unknown as Parameters<RedisIoAdapter['close']>[0]),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
