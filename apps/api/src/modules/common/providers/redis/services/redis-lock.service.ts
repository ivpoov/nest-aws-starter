import { randomUUID } from 'node:crypto';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import { REDIS_LOCK_KEY_PREFIX } from '@providers/redis/constants/redis-lock.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

// Compare-and-delete: only the owner token that set the key may remove it, so
// a lock-holder that outlives its own TTL never deletes a newer holder's lock.
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// Reusable distributed lock (SET NX PX + Lua-safe release) — not scheduler-
// specific, any consumer that needs "only one instance does this" uses it.
@Injectable()
export class RedisLockService {
  private readonly logger = new CustomLoggerService(RedisLockService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  // Runs `fn` only if the lock is acquired; returns null (skipped) when
  // another holder already owns it. The lock always releases, even on error.
  public async withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    const token: string | null = await this.acquire(name, ttlMs);

    if (token === null) return null;

    try {
      return await fn();
    } finally {
      await this.release(name, token);
    }
  }

  public async acquire(name: string, ttlMs: number): Promise<string | null> {
    const token: string = randomUUID();
    const result: 'OK' | null = await this.redis.set(this.keyFor(name), token, 'PX', ttlMs, 'NX');

    return result === 'OK' ? token : null;
  }

  public async release(name: string, token: string): Promise<void> {
    const key: string = this.keyFor(name);
    const deletedCount: unknown = await this.redis.eval(RELEASE_SCRIPT, 1, key, token);

    if (deletedCount !== 1) {
      this.logger.warn(`Lock release no-op — not the current owner or already expired: ${key}`);
    }
  }

  private keyFor(name: string): string {
    return `${REDIS_LOCK_KEY_PREFIX}${name}`;
  }
}
