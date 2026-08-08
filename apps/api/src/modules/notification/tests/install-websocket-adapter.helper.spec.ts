import type { WebsocketConfig } from '@configs/websocket.config.js';
import { DisabledIoAdapter } from '@modules/notification/adapters/disabled-io.adapter.js';
import { RedisIoAdapter } from '@modules/notification/adapters/redis-io.adapter.js';
import { installWebsocketAdapter } from '@modules/notification/helpers/install-websocket-adapter.helper.js';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { Server } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';

interface FakeAppInterface {
  readonly app: INestApplication;
  readonly useWebSocketAdapter: ReturnType<typeof vi.fn>;
  readonly duplicate: ReturnType<typeof vi.fn>;
  readonly connect: ReturnType<typeof vi.fn>;
  readonly resolvedTokens: unknown[];
}

function createApp(websocket: WebsocketConfig): FakeAppInterface {
  const connect = vi.fn().mockResolvedValue(undefined);
  const duplicate = vi.fn(() => ({ connect, quit: vi.fn() }));
  const configService = { getOrThrow: vi.fn().mockReturnValue(websocket) };
  const useWebSocketAdapter = vi.fn();
  const resolvedTokens: unknown[] = [];
  const get = vi.fn((token: unknown): unknown => {
    resolvedTokens.push(token);

    if (token === ConfigService) return configService;
    if (token === REDIS_CLIENT) return { duplicate };

    throw new Error(`Unexpected token requested from the container: ${String(token)}`);
  });

  return {
    app: { get, useWebSocketAdapter } as unknown as INestApplication,
    useWebSocketAdapter,
    duplicate,
    connect,
    resolvedTokens,
  };
}

// backend.md §12: an optional transport is on or off, never half-configured.
// "Off" has to mean no socket endpoint AND no adapter Redis connections —
// the previous wiring installed the Redis adapter unconditionally and only
// let the gateway drop handshakes after accepting them, i.e. it held two
// Redis connections for the process lifetime and generated reconnect loops.
describe('installWebsocketAdapter', () => {
  const enabled: WebsocketConfig = { isEnabled: true, heartbeatIntervalMs: 60_000 };
  const disabled: WebsocketConfig = { isEnabled: false, heartbeatIntervalMs: 60_000 };

  it('installs the Redis-backed adapter and connects its pub/sub pair when enabled', async () => {
    const fake: FakeAppInterface = createApp(enabled);

    await installWebsocketAdapter(fake.app);

    expect(fake.useWebSocketAdapter).toHaveBeenCalledExactlyOnceWith(expect.any(RedisIoAdapter));
    expect(fake.duplicate).toHaveBeenCalledTimes(2);
    expect(fake.connect).toHaveBeenCalledTimes(2);
  });

  it('opens no Redis connection at all when disabled', async () => {
    const fake: FakeAppInterface = createApp(disabled);

    await installWebsocketAdapter(fake.app);

    expect(fake.useWebSocketAdapter).toHaveBeenCalledExactlyOnceWith(expect.any(DisabledIoAdapter));
    expect(fake.resolvedTokens).not.toContain(REDIS_CLIENT);
    expect(fake.duplicate).not.toHaveBeenCalled();
    expect(fake.connect).not.toHaveBeenCalled();
  });

  it('reads the flag through ConfigService, never a raw env lookup', async () => {
    const fake: FakeAppInterface = createApp(disabled);

    await installWebsocketAdapter(fake.app);

    expect(fake.app.get(ConfigService).getOrThrow).toHaveBeenCalledWith('websocket');
  });

  it('builds a detached server bound to no HTTP server when disabled', () => {
    const fake: FakeAppInterface = createApp(disabled);
    const server: Server = new DisabledIoAdapter(fake.app).createIOServer(3000);

    // No httpServer means no `/socket.io` route exists on the API port, so a
    // handshake is refused outright instead of accepted and dropped.
    expect(server.httpServer).toBeUndefined();
  });
});
