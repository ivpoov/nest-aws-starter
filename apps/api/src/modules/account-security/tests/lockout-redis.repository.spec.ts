import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import { FAILED_LOGIN_WINDOW_SEC } from '@modules/account-security/constants/account-security.constants.js';
import type { LockoutRecordInterface } from '@modules/account-security/interfaces/lockout-record.interface.js';
import { LockoutRedisRepository } from '@modules/account-security/repositories/lockout-redis.repository.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { LockoutScopeEnum } from '@nest-aws-starter/shared';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { describe, expect, it, vi } from 'vitest';

const KEYS_PER_SCAN_PAGE = 40;
const SCAN_PAGES = 5;

// Five SCAN pages of forty keys — 200 lockouts, the shape a distributed
// credential-stuffing run leaves behind. Every key is live (ttl > 0), so
// nothing is dropped by the expiry filter and the returned count is purely
// the cap's doing.
function createRepository(): {
  repository: LockoutRedisRepository;
  scan: ReturnType<typeof vi.fn>;
} {
  let page: number = 0;
  const scan = vi.fn().mockImplementation((): Promise<[string, string[]]> => {
    page += 1;

    const batch: string[] = Array.from(
      { length: KEYS_PER_SCAN_PAGE },
      (_unused: unknown, index: number): string =>
        `suspicious:lockout:IP:10.0.${page}.${index + 1}`,
    );

    return Promise.resolve([page < SCAN_PAGES ? String(page) : '0', batch]);
  });
  const redis = { scan, ttl: vi.fn().mockResolvedValue(60) } as unknown as RedisClientType;

  return { repository: new LockoutRedisRepository(redis), scan };
}

interface MultiStubInterface {
  readonly incr: ReturnType<typeof vi.fn>;
  readonly expire: ReturnType<typeof vi.fn>;
  readonly exec: ReturnType<typeof vi.fn>;
}

// A MULTI chain that records what was queued and replays a caller-supplied
// EXEC result, so the spec can assert both the queued commands and the parsing.
function createMultiRepository(execResult: [Error | null, unknown][] | null): {
  repository: LockoutRedisRepository;
  multi: MultiStubInterface;
} {
  const multi: MultiStubInterface = {
    incr: vi.fn((): MultiStubInterface => multi),
    expire: vi.fn((): MultiStubInterface => multi),
    exec: vi.fn().mockResolvedValue(execResult),
  };
  const redis = { multi: vi.fn((): MultiStubInterface => multi) } as unknown as RedisClientType;

  return { repository: new LockoutRedisRepository(redis), multi };
}

describe('LockoutRedisRepository.incrementFailedAttempts', () => {
  // The counter and its TTL must be queued as ONE unit. As two round trips a
  // failure in between left a counter with no expiry, and the old
  // `count === 1` guard meant nothing ever re-armed it — the count then climbed
  // forever, re-locking that email or IP on every failed login once past the
  // threshold: a permanent self-inflicted lockout.
  it('queues the increment and the expiry in a single MULTI', async () => {
    const { repository, multi } = createMultiRepository([
      [null, 3],
      [null, 1],
    ]);

    const count: number = await repository.incrementFailedAttempts(LockoutScopeEnum.IP, '10.0.0.1');

    expect(count).toBe(3);
    expect(multi.incr).toHaveBeenCalledWith('suspicious:fail:IP:10.0.0.1');
    expect(multi.exec).toHaveBeenCalledTimes(1);
  });

  // NX, not a bare EXPIRE: the window is armed only when the key has none, so a
  // later attempt inside a live window never pushes its expiry out — the same
  // reason `lock()` uses SET NX.
  it('arms the window with EXPIRE ... NX so a later attempt never extends it', async () => {
    const { repository, multi } = createMultiRepository([
      [null, 2],
      [null, 0],
    ]);

    await repository.incrementFailedAttempts(LockoutScopeEnum.EMAIL, 'user@example.com');

    expect(multi.expire).toHaveBeenCalledWith(
      'suspicious:fail:EMAIL:user@example.com',
      FAILED_LOGIN_WINDOW_SEC,
      'NX',
    );
  });

  it.each([
    [null],
    [[] as [Error | null, unknown][]],
    [[[new Error('redis down'), null]] as [Error | null, unknown][]],
  ])('throws rather than guessing a count when EXEC returns %p', async (execResult) => {
    const { repository } = createMultiRepository(execResult);

    await expect(
      repository.incrementFailedAttempts(LockoutScopeEnum.IP, '10.0.0.1'),
    ).rejects.toThrow(InternalError);
  });
});

describe('LockoutRedisRepository.findAllLockouts', () => {
  it('caps the lockout list at the shared page-size budget', async () => {
    const { repository } = createRepository();

    const records: LockoutRecordInterface[] = await repository.findAllLockouts();

    expect(records).toHaveLength(MAX_PAGE_SIZE);
  });

  it('abandons the key scan once the cap is reached rather than walking to the end', async () => {
    const { repository, scan } = createRepository();

    await repository.findAllLockouts();

    // Three pages of forty pass the cap; pages four and five never run.
    expect(scan).toHaveBeenCalledTimes(3);
  });
});
