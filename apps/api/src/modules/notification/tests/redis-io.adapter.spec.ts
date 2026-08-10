import type { AppConfig } from '@configs/app.config.js';
import type { CorsOriginDelegateType } from '@modules/common/types/cors-origin-delegate.type.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { RedisIoAdapter } from '@modules/notification/adapters/redis-io.adapter.js';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { ServerOptions } from 'socket.io';
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

// Socket CORS is no longer a plain array: `createIOServer` hands Socket.IO
// the shared origin delegate (create-cors-origin-delegate.helper.ts), the
// same value configure-app.helper.ts hands @fastify/cors. Asserting what the
// delegate answers — not that some particular array reached the server — is
// what still proves the adapter reads AppConfig and nothing of its own.
function askDelegate(origin: string, options: ServerOptions | undefined): boolean {
  const delegate: CorsOriginDelegateType = (
    options as unknown as { cors: { origin: CorsOriginDelegateType } }
  ).cors.origin;
  const answers: boolean[] = [];

  delegate(origin, (error: Error | null, isAllowed: boolean): void => {
    expect(error).toBeNull();
    answers.push(isAllowed);
  });

  expect(answers).toHaveLength(1);

  return answers[0] === true;
}

// Stands in for the real container: the adapter must reach socket CORS
// through the same `ConfigService.getOrThrow('app')` object the HTTP layer
// uses, never through a second env read of its own.
function createApp(
  pub: FakeRedisClient,
  sub: FakeRedisClient,
  corsOrigins: string[] = CONFIGURED_ORIGINS,
  env: AppConfig['env'] = 'production',
): INestApplicationContext {
  const duplicate = vi.fn().mockReturnValueOnce(pub).mockReturnValueOnce(sub);
  const configService = {
    getOrThrow: vi.fn().mockReturnValue({ corsOrigins, env } as AppConfig),
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
  // origins. Socket CORS must come from AppConfig — through the same origin
  // delegate configure-app.helper.ts feeds to enableCors.
  it('takes socket CORS from AppConfig, the same object the HTTP layer uses', async () => {
    const createIOServerSpy = vi
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({ adapter: vi.fn() });

    const app: INestApplicationContext = createApp(createDuplicate(), createDuplicate());
    const adapter: RedisIoAdapter = new RedisIoAdapter(app);

    await adapter.connectToRedis();
    adapter.createIOServer(3000, { path: '/socket.io' } as never);

    const options: ServerOptions | undefined = createIOServerSpy.mock.calls[0]?.[1];

    expect(app.get(ConfigService).getOrThrow).toHaveBeenCalledWith('app');
    expect(createIOServerSpy).toHaveBeenCalledWith(
      3000,
      expect.objectContaining({ path: '/socket.io', cors: { origin: expect.any(Function) } }),
    );
    expect(askDelegate(CONFIGURED_ORIGINS[0] ?? '', options)).toBe(true);
    expect(askDelegate('https://evil.example', options)).toBe(false);
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

    const options: ServerOptions | undefined = createIOServerSpy.mock.calls[0]?.[1];

    expect(askDelegate('https://only-source-of-truth.example', options)).toBe(true);
    expect(askDelegate(CONFIGURED_ORIGINS[0] ?? '', options)).toBe(false);
  });

  // The socket transport carries the development loopback latitude because it
  // is built from the same AppConfig — including `env`. A regression that read
  // only `corsOrigins` here would leave a developer on an unusual Vite port
  // with working HTTP calls and a silently blocked socket.
  it('carries the development loopback rule onto the socket transport', async () => {
    const createIOServerSpy = vi
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({ adapter: vi.fn() });

    const adapter: RedisIoAdapter = new RedisIoAdapter(
      createApp(createDuplicate(), createDuplicate(), CONFIGURED_ORIGINS, 'development'),
    );

    await adapter.connectToRedis();
    adapter.createIOServer(0);

    const options: ServerOptions | undefined = createIOServerSpy.mock.calls[0]?.[1];

    expect(askDelegate('http://localhost:61234', options)).toBe(true);
    expect(askDelegate('http://localhost.evil.tld', options)).toBe(false);
  });

  // ...and never in production: `env` is the only switch, and it is the
  // resolved config value, not something the adapter can be talked into.
  it('refuses every loopback origin on the socket transport in production', async () => {
    const createIOServerSpy = vi
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({ adapter: vi.fn() });

    const adapter: RedisIoAdapter = new RedisIoAdapter(
      createApp(createDuplicate(), createDuplicate(), CONFIGURED_ORIGINS, 'production'),
    );

    await adapter.connectToRedis();
    adapter.createIOServer(0);

    const options: ServerOptions | undefined = createIOServerSpy.mock.calls[0]?.[1];

    expect(askDelegate('http://localhost:61234', options)).toBe(false);
    expect(askDelegate('http://127.0.0.1:5173', options)).toBe(false);
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
