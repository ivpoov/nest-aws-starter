import {
  NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX,
  NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC,
} from '@modules/notification/constants/notification-email-throttle.constants.js';
import { NotificationEmailThrottleRedisRepository } from '@modules/notification/repositories/notification-email-throttle-redis.repository.js';
import { NotificationTypeEnum } from '@nest-aws-starter/shared';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { describe, expect, it, vi } from 'vitest';

// The window is claimed with ONE Redis command, not a get-then-set: two
// concurrent claims for the same (user, type) must not both be able to
// observe "no key yet" and both send. Real-Redis concurrency (10 parallel
// claims -> exactly 1 winner) is proven in
// test/notification-event-subscriber.e2e-spec.ts; this spec pins the command shape
// and the key namespace the e2e reads.
describe('NotificationEmailThrottleRedisRepository', () => {
  function createRepository(setResult: string | null): {
    repository: NotificationEmailThrottleRedisRepository;
    set: ReturnType<typeof vi.fn>;
  } {
    const set = vi.fn().mockResolvedValue(setResult);
    const redis = { set } as unknown as RedisClientType;

    return { repository: new NotificationEmailThrottleRedisRepository(redis), set };
  }

  it('claims the slot with a single atomic SET NX EX scoped to the user and type', async () => {
    const { repository, set } = createRepository('OK');

    const claimed: boolean = await repository.claim(
      'user-1',
      NotificationTypeEnum.NEW_DEVICE_LOGIN,
    );

    expect(claimed).toBe(true);
    expect(set).toHaveBeenCalledExactlyOnceWith(
      `${NOTIFICATION_EMAIL_THROTTLE_KEY_PREFIX}:user-1:NEW_DEVICE_LOGIN`,
      '1',
      'EX',
      NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC,
      'NX',
    );
  });

  it('reports the slot as taken when the key already exists inside the window', async () => {
    const { repository } = createRepository(null);

    await expect(repository.claim('user-1', NotificationTypeEnum.NEW_DEVICE_LOGIN)).resolves.toBe(
      false,
    );
  });

  it('keys each type separately so one type never consumes another’s window', async () => {
    const { repository, set } = createRepository('OK');

    await repository.claim('user-1', NotificationTypeEnum.NEW_DEVICE_LOGIN);
    await repository.claim('user-1', NotificationTypeEnum.PAYMENT_FAILED);

    const keys: unknown[] = set.mock.calls.map((call: unknown[]): unknown => call[0]);

    expect(new Set(keys).size).toBe(2);
  });

  it('uses a one-hour window', () => {
    expect(NOTIFICATION_EMAIL_THROTTLE_WINDOW_SEC).toBe(3_600);
  });
});
