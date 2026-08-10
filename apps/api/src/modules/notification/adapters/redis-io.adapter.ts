import type { AppConfig } from '@configs/app.config.js';
import { createCorsOriginDelegate } from '@helpers/create-cors-origin-delegate.helper.js';
import type { CorsOriginDelegateType } from '@modules/common/types/cors-origin-delegate.type.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { createAdapter } from '@socket.io/redis-adapter';
import { Cluster } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

// Wires Socket.IO to Redis pub/sub so `server.to(room).emit(...)` fans out
// across every API instance, not just the one that happens to hold the
// recipient's live connection — required for multi-instance deployments
// (Task 2 brief: "Socket.IO on the API (Redis adapter for multi-instance)").
// Two duplicated ioredis connections are required by the adapter (one
// publishes, one subscribes) — reusing REDIS_CLIENT itself for both roles
// isn't possible because a client in subscriber mode can't issue other
// commands.
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new CustomLoggerService(RedisIoAdapter.name);
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  // Must be awaited before the app starts accepting connections — call this
  // right after `NestFactory.create()` (or `Test.createTestingModule` in
  // e2e), before `app.listen()`/`app.init()`, so `createIOServer` below
  // always has the adapter constructor ready by the time the gateway binds
  // its namespace.
  public async connectToRedis(): Promise<void> {
    const redis: RedisClientType = this.app.get(REDIS_CLIENT);
    const pubClient: RedisClientType = this.duplicate(redis);
    const subClient: RedisClientType = this.duplicate(redis);

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  // `RedisClientType`'s two branches (`Redis`/`Cluster`) each declare
  // `duplicate()` with a different, mutually-incompatible parameter list —
  // calling it on the union type directly doesn't type-check, only on a
  // branch narrowed by `instanceof`.
  private duplicate(client: RedisClientType): RedisClientType {
    return client instanceof Cluster ? client.duplicate() : client.duplicate();
  }

  // Socket CORS comes from the exact same resolved config object as HTTP
  // CORS (AppConfig — one parse, in app.config.ts, consumed by
  // configure-app.helper.ts for HTTP and here for WS), through the exact same
  // origin delegate, so the two transports cannot answer an origin question
  // differently. Never a separate env read: gateway decorator options
  // evaluate at module-import time, before .env is loaded, which is how a
  // `.env`-configured deploy would silently get localhost socket origins
  // while HTTP CORS got the real ones.
  public override createIOServer(port: number, options?: ServerOptions): Server {
    const corsOrigin: CorsOriginDelegateType = this.resolveCorsOrigin();
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: { origin: corsOrigin },
    } as ServerOptions);

    if (this.adapterConstructor) server.adapter(this.adapterConstructor);

    return server;
  }

  private resolveCorsOrigin(): CorsOriginDelegateType {
    return createCorsOriginDelegate(this.app.get(ConfigService).getOrThrow<AppConfig>('app'));
  }

  // Hooked automatically by Nest (SocketModule.close() calls
  // `adapter.close(server)` for every gateway server on app shutdown) —
  // closes the io server first, then the two duplicated Redis connections
  // so they never outlive the app.
  public override async close(server: Server): Promise<void> {
    await super.close(server);
    await this.quitDuplicatedClients();
  }

  private async quitDuplicatedClients(): Promise<void> {
    try {
      await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Failed to close websocket Redis adapter connections: ${message}`);
    }
  }
}
