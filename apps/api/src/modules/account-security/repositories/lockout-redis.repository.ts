import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import {
  FAILED_LOGIN_WINDOW_SEC,
  LOCKOUT_TTL_SEC,
} from '@modules/account-security/constants/account-security.constants.js';
import type { LockoutKeyInterface } from '@modules/account-security/interfaces/lockout-key.interface.js';
import type { LockoutRecordInterface } from '@modules/account-security/interfaces/lockout-record.interface.js';
import type { LockoutRepositoryInterface } from '@modules/account-security/interfaces/lockout-repository.interface.js';
import { LockoutScopeEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';

const COUNTER_PREFIX = 'suspicious:fail';
const LOCK_PREFIX = 'suspicious:lockout';

// No DB state for lockouts — Redis is the only source of truth, and it is
// disposable by design: a flushed cache just means every counter resets.
@Injectable()
export class LockoutRedisRepository implements LockoutRepositoryInterface {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async incrementFailedAttempts(scope: LockoutScopeEnum, value: string): Promise<number> {
    const key: string = this.counterKey(scope, value);
    const count: number = await this.redis.incr(key);

    if (count === 1) await this.redis.expire(key, FAILED_LOGIN_WINDOW_SEC);

    return count;
  }

  public async isLocked(scope: LockoutScopeEnum, value: string): Promise<boolean> {
    const exists: number = await this.redis.exists(this.lockKey(scope, value));

    return exists === 1;
  }

  // SET NX: only the first breach of a lockout window sets the key — later
  // failed attempts while already locked must not keep pushing the TTL out.
  public async lock(scope: LockoutScopeEnum, value: string): Promise<boolean> {
    const result: string | null = await this.redis.set(
      this.lockKey(scope, value),
      '1',
      'EX',
      LOCKOUT_TTL_SEC,
      'NX',
    );

    return result === 'OK';
  }

  public async resetFailedAttempts(scope: LockoutScopeEnum, value: string): Promise<void> {
    await this.redis.del(this.counterKey(scope, value));
  }

  public async release(scope: LockoutScopeEnum, value: string): Promise<void> {
    await this.redis.del(this.lockKey(scope, value), this.counterKey(scope, value));
  }

  // Capped: GET /admin/account-security/lockouts takes no `limit`, and a
  // distributed credential-stuffing run writes one key per source — the scan
  // and the per-key TTL fan-out below both grow with the attack. The cap
  // bounds them to the shared page-size budget.
  public async findAllLockouts(): Promise<LockoutRecordInterface[]> {
    const keys: string[] = await this.scanKeys(`${LOCK_PREFIX}:*`, MAX_PAGE_SIZE);
    const records: (LockoutRecordInterface | null)[] = await Promise.all(
      keys.map((key: string): Promise<LockoutRecordInterface | null> => this.toRecord(key)),
    );

    return records.filter(
      (record: LockoutRecordInterface | null): record is LockoutRecordInterface => record !== null,
    );
  }

  // SCAN returns an unbounded number of keys across its cursor walk, so the
  // limit is enforced inside the loop: stopping early leaves the remaining
  // keys unread rather than materializing them and slicing afterwards.
  private async scanKeys(pattern: string, limit: number): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string = '0';

    do {
      const [nextCursor, batch]: [string, string[]] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== '0' && keys.length < limit);

    return keys.slice(0, limit);
  }

  private async toRecord(key: string): Promise<LockoutRecordInterface | null> {
    const ttlSec: number = await this.redis.ttl(key);

    if (ttlSec <= 0) return null;

    const { scope, value } = this.parseLockKey(key);

    return { scope, value, ttlSec };
  }

  // IPv6 values contain colons, so only the scope segment is a plain split —
  // everything after it (including further colons) is the value.
  private parseLockKey(key: string): LockoutKeyInterface {
    const rest: string = key.slice(`${LOCK_PREFIX}:`.length);
    const separatorIndex: number = rest.indexOf(':');

    return {
      scope: rest.slice(0, separatorIndex) as LockoutScopeEnum,
      value: rest.slice(separatorIndex + 1),
    };
  }

  private counterKey(scope: LockoutScopeEnum, value: string): string {
    return `${COUNTER_PREFIX}:${scope}:${value}`;
  }

  private lockKey(scope: LockoutScopeEnum, value: string): string {
    return `${LOCK_PREFIX}:${scope}:${value}`;
  }
}
