import type { WebsocketConfig } from '@configs/websocket.config.js';
import { WebsocketHandshakeLimiterService } from '@modules/notification/services/websocket-handshake-limiter.service.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { describe, expect, it, vi } from 'vitest';

const config: WebsocketConfig = {
  isEnabled: true,
  heartbeatIntervalMs: 60_000,
  maxConnectionsPerUser: 10,
  handshakesPerMinutePerIp: 3,
  heartbeatConcurrency: 25,
  maxPayloadBytes: 8_192,
};

function createService(redis: Partial<RedisClientType>): WebsocketHandshakeLimiterService {
  return new WebsocketHandshakeLimiterService(redis as RedisClientType, config);
}

describe('WebsocketHandshakeLimiterService', () => {
  it('allows attempts up to the configured limit and refuses the one after', async () => {
    let count = 0;
    const service: WebsocketHandshakeLimiterService = createService({
      incr: vi.fn(async () => {
        count += 1;

        return count;
      }),
      pexpire: vi.fn().mockResolvedValue(1),
    });

    const verdicts: boolean[] = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      verdicts.push(await service.isWithinLimit('203.0.113.7'));
    }

    expect(verdicts).toEqual([true, true, true, false]);
  });

  // The window is only set on the first attempt. Without that guard every
  // attempt would push the expiry out and the counter would never reset, which
  // turns a rate limit into a permanent ban after the limit is first reached.
  it('sets the window once, on the first attempt', async () => {
    const pexpire = vi.fn().mockResolvedValue(1);
    let count = 0;
    const service: WebsocketHandshakeLimiterService = createService({
      incr: vi.fn(async () => {
        count += 1;

        return count;
      }),
      pexpire,
    });

    await service.isWithinLimit('203.0.113.7');
    await service.isWithinLimit('203.0.113.7');

    expect(pexpire).toHaveBeenCalledTimes(1);
  });

  // Availability over strictness, as with the login lockout and the email
  // throttle: a Redis outage must not take live notifications down for
  // everybody. The worst case is an unmetered connect path during the outage.
  it('fails open when redis is unavailable', async () => {
    const service: WebsocketHandshakeLimiterService = createService({
      incr: vi.fn().mockRejectedValue(new Error('Connection is closed.')),
      pexpire: vi.fn(),
    });

    await expect(service.isWithinLimit('203.0.113.7')).resolves.toBe(true);
  });
});
