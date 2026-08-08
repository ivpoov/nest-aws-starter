import type { WebsocketConfig } from '@configs/websocket.config.js';
import { DisabledIoAdapter } from '@modules/notification/adapters/disabled-io.adapter.js';
import { RedisIoAdapter } from '@modules/notification/adapters/redis-io.adapter.js';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// The single wiring point for the notification WS transport, shared by
// main.ts and test/app.factory.ts. Must run after the DI container exists
// (config is resolved through ConfigService, never from a raw env read) and
// before listen()/init(), so the gateway's namespace binds against the
// chosen adapter from the start. WEBSOCKET_ENABLED=false means off:
// DisabledIoAdapter never attaches a socket server and RedisIoAdapter's two
// pub/sub connections are never opened.
export async function installWebsocketAdapter(app: INestApplication): Promise<void> {
  const config: WebsocketConfig = app.get(ConfigService).getOrThrow<WebsocketConfig>('websocket');

  if (!config.isEnabled) {
    app.useWebSocketAdapter(new DisabledIoAdapter(app));

    return;
  }

  const adapter: RedisIoAdapter = new RedisIoAdapter(app);

  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);
}
