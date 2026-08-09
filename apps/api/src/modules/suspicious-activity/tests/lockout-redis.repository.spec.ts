import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import type { LockoutRecordInterface } from '@modules/suspicious-activity/interfaces/lockout-record.interface.js';
import { LockoutRedisRepository } from '@modules/suspicious-activity/repositories/lockout-redis.repository.js';
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
