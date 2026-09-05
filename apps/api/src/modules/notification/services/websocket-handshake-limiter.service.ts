import { type WebsocketConfig, websocketConfig } from '@configs/websocket.config.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

const WINDOW_MS = 60_000;

// Rate limits the socket HANDSHAKE, which nothing else does.
//
// ThrottlerGuard protects `@SubscribeMessage` handlers, and this gateway has
// none — every message it sends is server-initiated. So the connect path, the
// one place an anonymous client can make the server do work, was the only
// unmetered entry point in the application. Each attempt costs a JWT verify
// and a Redis read before it can be rejected.
//
// In Redis rather than process memory, deliberately: a per-instance counter is
// a limit an attacker removes by reconnecting until they land on another node,
// and this project runs behind a load balancer by design. Same reasoning, and
// the same key shape, as ThrottlerRedisStorageService — that class is not
// reused directly because it implements Nest's `ThrottlerStorage` for the HTTP
// guard pipeline, and a handshake is not a request travelling through it.
@Injectable()
export class WebsocketHandshakeLimiterService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClientType,
    @Inject(websocketConfig.KEY) private readonly config: WebsocketConfig,
  ) {}

  // Fails OPEN. A Redis outage must not take the notification transport down
  // with it — the same availability-over-strictness posture as the login
  // lockout and the notification email throttle. Worst case during an outage
  // is an unmetered connect path; the alternative is no live notifications at
  // all for everyone.
  public async isWithinLimit(address: string): Promise<boolean> {
    try {
      const key: string = `ws:handshake:${address}`;
      const attempts: number = await this.redis.incr(key);

      if (attempts === 1) await this.redis.pexpire(key, WINDOW_MS);

      return attempts <= this.config.handshakesPerMinutePerIp;
    } catch {
      return true;
    }
  }
}
