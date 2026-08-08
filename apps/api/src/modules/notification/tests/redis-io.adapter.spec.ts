import type { AppConfig } from '@configs/app.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RedisIoAdapter } from '@modules/notification/adapters/redis-io.adapter.js';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeRedisClient {
  readonly connect: ReturnType<typeof vi.fn>;
  readonly quit: ReturnType<typeof vi.fn>;
}

const CONFIGURED_ORIGINS: string[] = ['https://app.example.com', 'https://admin.example.com'];

function createDuplicate(): FakeRedisClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
  };
}

// Stands in for the real container: the adapter must reach socket CORS
// through the same `ConfigService.getOrThrow('app')` object the HTTP layer
// uses, never through a second env read of its own.
function createApp(
  pub: FakeRedisClient,
  sub: FakeRedisClient,
  corsOrigins: string[] = CONFIGURED_ORIGINS,
): INestApplicationContext {
  const duplicate = vi.fn().mockReturnValueOnce(pub).mockReturnValueOnce(sub);
  const configService = {
    getOrThrow: vi.fn().mockReturnValue({ corsOrigins } as AppConfig),
  };
  const get = vi.fn((token: unknown): unknown => {
    if (token === ConfigService) return configService;
    if (token === REDIS_CLIENT) return { duplicate };

    throw new Error(`Unexpected token requested from the container: ${String(token)}`);
  });

  return { get } as unknown as INestApplicationContext;
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

  // Regression guard for the divergence this replaced: the gateway used to
  // compute its own CORS list from process.env at module-import time, which
  // runs before loadEnv(), so a .env-configured deploy silently got the
  // localhost fallback on the socket endpoint while HTTP CORS got the real
  // origins. Socket CORS must come from AppConfig.corsOrigins — the one
  // field configure-app.helper.ts feeds to enableCors.
  it('takes socket CORS from AppConfig.corsOrigins, the same field the HTTP layer uses', async () => {
    const createIOServerSpy = vi
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({ adapter: vi.fn() });

    const app: INestApplicationContext = createApp(createDuplicate(), createDuplicate());
    const adapter: RedisIoAdapter = new RedisIoAdapter(app);

    await adapter.connectToRedis();
    adapter.createIOServer(3000, { path: '/socket.io' } as never);

    expect(app.get(ConfigService).getOrThrow).toHaveBeenCalledWith('app');
    expect(createIOServerSpy).toHaveBeenCalledWith(
      3000,
      expect.objectContaining({ path: '/socket.io', cors: { origin: CONFIGURED_ORIGINS } }),
    );
  });

  it('never falls back to a CORS list of its own when the app config changes', async () => {
    const createIOServerSpy = vi
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({ adapter: vi.fn() });
    const origins: string[] = ['https://only-source-of-truth.example'];

    const adapter: RedisIoAdapter = new RedisIoAdapter(
      createApp(createDuplicate(), createDuplicate(), origins),
    );

    await adapter.connectToRedis();
    adapter.createIOServer(0);

    expect(createIOServerSpy).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ cors: { origin: origins } }),
    );
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
