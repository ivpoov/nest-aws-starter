import { NOTIFICATION_PREFERENCE_CACHE_TTL_MS } from '@modules/notification/constants/notification-preference.constants.js';
import { buildNotificationPreferenceCacheKey } from '@modules/notification/constants/notification-preference-cache-key.constants.js';
import type { NotificationPreferenceRepositoryInterface } from '@modules/notification/interfaces/notification-preference-repository.interface.js';
import type { StoredNotificationPreferenceInterface } from '@modules/notification/interfaces/stored-notification-preference.interface.js';
import { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import {
  NotificationChannelEnum,
  NotificationTypeEnum,
  type UpdateNotificationPreferenceRequestInterface,
} from '@nest-aws-starter/shared';
import type { CacheService } from '@providers/cache/services/cache.service.js';
import type { CacheFactoryService } from '@providers/cache/services/cache-factory.service.js';
import { describe, expect, it, vi } from 'vitest';

const userId = '01890a5d-0000-774b-bcce-b30209990001';

interface TestSetupInterface {
  readonly service: NotificationPreferenceService;
  readonly preferenceRepository: NotificationPreferenceRepositoryInterface;
  readonly cacheWrap: ReturnType<typeof vi.fn>;
  readonly cacheDelete: ReturnType<typeof vi.fn>;
}

function createService(stored: StoredNotificationPreferenceInterface[] = []): TestSetupInterface {
  const preferenceRepository: NotificationPreferenceRepositoryInterface = {
    findManyByUserId: vi.fn().mockResolvedValue(stored),
    upsertMany: vi.fn().mockResolvedValue(undefined),
  };
  // Pass-through cache: unit tests assert the key/ttl passed in and that a
  // miss runs the factory — actual store behaviour is CacheService's (same
  // convention as StatisticService's tests).
  const cacheWrap = vi.fn(
    (_key: string, _ttlMs: number, factory: () => Promise<unknown>): Promise<unknown> => factory(),
  );
  const cacheDelete = vi.fn().mockResolvedValue(undefined);
  const cache = { wrap: cacheWrap, delete: cacheDelete } as unknown as CacheService;
  const cacheFactory = { create: vi.fn().mockReturnValue(cache) } as unknown as CacheFactoryService;
  const service = new NotificationPreferenceService(preferenceRepository, cacheFactory);

  return { service, preferenceRepository, cacheWrap, cacheDelete };
}

describe('NotificationPreferenceService.getMatrix', () => {
  it('returns IN_APP always-on/non-editable and EMAIL defaults when no rows are stored', async () => {
    const { service } = createService([]);

    const matrix = await service.getMatrix(userId);

    const passwordChanged = matrix.filter(
      (row) => row.type === NotificationTypeEnum.PASSWORD_CHANGED,
    );

    expect(passwordChanged).toEqual([
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.IN_APP,
        enabled: true,
        isEditable: false,
      },
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: true,
        isEditable: true,
      },
    ]);
  });

  it('defaults SUBSCRIPTION_RENEWED EMAIL to off (the one documented exception)', async () => {
    const { service } = createService([]);

    const matrix = await service.getMatrix(userId);
    const row = matrix.find(
      (candidate) =>
        candidate.type === NotificationTypeEnum.SUBSCRIPTION_RENEWED &&
        candidate.channel === NotificationChannelEnum.EMAIL,
    );

    expect(row?.enabled).toBe(false);
  });

  it('a stored EMAIL override wins over the default', async () => {
    const { service } = createService([
      {
        type: NotificationTypeEnum.SUBSCRIPTION_RENEWED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: true,
      },
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]);

    const matrix = await service.getMatrix(userId);
    const renewed = matrix.find(
      (row) =>
        row.type === NotificationTypeEnum.SUBSCRIPTION_RENEWED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );
    const passwordChanged = matrix.find(
      (row) =>
        row.type === NotificationTypeEnum.PASSWORD_CHANGED &&
        row.channel === NotificationChannelEnum.EMAIL,
    );

    expect(renewed?.enabled).toBe(true);
    expect(passwordChanged?.enabled).toBe(false);
  });

  it('only covers USER-audience types — no row for an ADMIN-audience type', async () => {
    const { service } = createService([]);

    const matrix = await service.getMatrix(userId);

    expect(matrix.some((row) => row.type === NotificationTypeEnum.USER_BLOCKED)).toBe(false);
    expect(matrix.some((row) => row.type === NotificationTypeEnum.SUSPICIOUS_LOGIN)).toBe(false);
  });

  it('reads through the cache with the module TTL, keyed per user', async () => {
    const { service, cacheWrap } = createService([]);

    await service.getMatrix(userId);

    expect(cacheWrap).toHaveBeenCalledWith(
      buildNotificationPreferenceCacheKey(userId),
      NOTIFICATION_PREFERENCE_CACHE_TTL_MS,
      expect.any(Function),
    );
  });
});

describe('NotificationPreferenceService.isEmailEnabled', () => {
  it('resolves the default when nothing is stored', async () => {
    const { service } = createService([]);

    await expect(
      service.isEmailEnabled(userId, NotificationTypeEnum.PASSWORD_CHANGED),
    ).resolves.toBe(true);
    await expect(
      service.isEmailEnabled(userId, NotificationTypeEnum.SUBSCRIPTION_RENEWED),
    ).resolves.toBe(false);
  });

  it('resolves a stored override', async () => {
    const { service } = createService([
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]);

    await expect(
      service.isEmailEnabled(userId, NotificationTypeEnum.PASSWORD_CHANGED),
    ).resolves.toBe(false);
  });

  it('is always false for an ADMIN-audience type (no per-user recipient)', async () => {
    const { service, preferenceRepository } = createService([]);

    await expect(service.isEmailEnabled(userId, NotificationTypeEnum.USER_BLOCKED)).resolves.toBe(
      false,
    );
    expect(preferenceRepository.findManyByUserId).not.toHaveBeenCalled();
  });
});

describe('NotificationPreferenceService.updateMany', () => {
  it('rejects a write that targets the immutable IN_APP channel', async () => {
    const { service, preferenceRepository } = createService([]);
    const updates: UpdateNotificationPreferenceRequestInterface[] = [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.IN_APP,
        enabled: false,
      },
    ];

    const caught = await service.updateMany(userId, updates).catch((error: unknown) => error);

    expect(caught).toMatchObject({ args: { code: 'NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE' } });
    expect(preferenceRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('rejects a write for a type with no per-user preference (ADMIN-audience)', async () => {
    const { service, preferenceRepository } = createService([]);
    const updates: UpdateNotificationPreferenceRequestInterface[] = [
      {
        type: NotificationTypeEnum.USER_BLOCKED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ];

    const caught = await service.updateMany(userId, updates).catch((error: unknown) => error);

    expect(caught).toMatchObject({ args: { code: 'NOTIFICATION_PREFERENCE_TYPE_INVALID' } });
    expect(preferenceRepository.upsertMany).not.toHaveBeenCalled();
  });

  // Atomicity: validate() runs synchronously over the whole batch (a plain
  // Array.map) before upsertMany is ever called — one bad row must abort
  // the entire batch, never a partial write.
  it('aborts the whole batch on a single invalid row — the valid row is never persisted', async () => {
    const { service, preferenceRepository } = createService([]);
    const updates: UpdateNotificationPreferenceRequestInterface[] = [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
      {
        type: NotificationTypeEnum.NEW_DEVICE_LOGIN,
        channel: NotificationChannelEnum.IN_APP,
        enabled: false,
      },
    ];

    const caught = await service.updateMany(userId, updates).catch((error: unknown) => error);

    expect(caught).toMatchObject({ args: { code: 'NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE' } });
    expect(preferenceRepository.upsertMany).not.toHaveBeenCalled();
  });

  it('persists valid EMAIL rows and invalidates the cache', async () => {
    const { service, preferenceRepository, cacheDelete } = createService([]);
    const updates: UpdateNotificationPreferenceRequestInterface[] = [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ];

    await service.updateMany(userId, updates);

    expect(preferenceRepository.upsertMany).toHaveBeenCalledWith(userId, [
      {
        type: NotificationTypeEnum.PASSWORD_CHANGED,
        channel: NotificationChannelEnum.EMAIL,
        enabled: false,
      },
    ]);
    expect(cacheDelete).toHaveBeenCalledWith(buildNotificationPreferenceCacheKey(userId));
  });
});
