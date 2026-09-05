import type { RetentionConfig } from '@configs/retention.config.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { ActivityRepositoryInterface } from '@modules/activity/interfaces/activity-repository.interface.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
import { FAKE_RETENTION_CONFIG } from '@modules/common/constants/retention-test.constants.js';
import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const activity: ActivityInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  userId: '01890a5d-0000-774b-bcce-b30209990001',
  actorId: null,
  sessionId: null,
  type: ActivityTypeEnum.AUTH_LOGIN,
  meta: null,
  ip: '127.0.0.1',
  createdAt: new Date('2026-08-03T12:00:00Z'),
};

interface TestSetupInterface {
  readonly service: ActivityService;
  readonly repository: ActivityRepositoryInterface;
  readonly deleteOlderThan: ReturnType<typeof vi.fn>;
}

function createService(
  overrides: Partial<ActivityRepositoryInterface> = {},
  retention: RetentionConfig = FAKE_RETENTION_CONFIG,
): TestSetupInterface {
  const deleteOlderThan = vi.fn().mockResolvedValue(0);
  const repository: ActivityRepositoryInterface = {
    create: vi.fn().mockResolvedValue(activity),
    findManyAfter: vi.fn().mockResolvedValue([activity]),
    deleteOlderThan,
    ...overrides,
  };
  const service: ActivityService = new ActivityService(repository, retention);

  return { service, repository, deleteOlderThan };
}

describe('ActivityService', () => {
  it('records an activity row via the repository', async () => {
    const { service, repository } = createService();

    const recorded: ActivityInterface = await service.record({
      userId: activity.userId,
      type: ActivityTypeEnum.AUTH_LOGIN,
      ip: activity.ip,
    });

    expect(recorded).toEqual(activity);
    expect(repository.create).toHaveBeenCalledWith({
      userId: activity.userId,
      type: ActivityTypeEnum.AUTH_LOGIN,
      ip: activity.ip,
    });
  });

  it('scopes the list by filters and pages by cursor', async () => {
    const secondActivity: ActivityInterface = {
      ...activity,
      id: '01890a5d-ac96-774b-bcce-b302099a9999',
    };
    const findManyAfter = vi.fn().mockResolvedValue([activity, secondActivity]);
    const { service } = createService({ findManyAfter });

    const pagination: CursorPaginationInterface = { cursor: null, limit: 2 };
    const filters: ActivityFiltersInterface = { userId: activity.userId };

    const page = await service.findMany(pagination, filters);

    expect(findManyAfter).toHaveBeenCalledWith(pagination, filters);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(secondActivity.id);

    const { service: shortService } = createService({
      findManyAfter: vi.fn().mockResolvedValue([activity]),
      deleteOlderThan: vi.fn(),
    });
    const shortPage = await shortService.findMany(pagination, filters);

    expect(shortPage.nextCursor).toBeNull();
  });

  describe('purgeExpired', () => {
    it('does nothing at all when retention is disabled', async () => {
      const { service, deleteOlderThan } = createService(
        {},
        { ...FAKE_RETENTION_CONFIG, isEnabled: false },
      );

      await expect(service.purgeExpired()).resolves.toBe(0);
      expect(deleteOlderThan).not.toHaveBeenCalled();
    });

    // The cutoff is what decides whether retention is a policy or an accident,
    // so it is asserted as a date rather than as "some argument".
    it('deletes rows older than the configured window and no others', async () => {
      const { service, deleteOlderThan } = createService(
        {},
        { ...FAKE_RETENTION_CONFIG, activityDays: 30, batchSize: 500 },
      );

      await service.purgeExpired();

      const [cutoff, limit] = deleteOlderThan.mock.calls[0] as [Date, number];
      const ageDays: number = (Date.now() - cutoff.getTime()) / 86_400_000;

      expect(ageDays).toBeCloseTo(30, 1);
      expect(limit).toBe(500);
    });

    it('keeps going until a pass comes back short', async () => {
      const { service, deleteOlderThan } = createService(
        {},
        { ...FAKE_RETENTION_CONFIG, batchSize: 10 },
      );
      deleteOlderThan.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

      await expect(service.purgeExpired()).resolves.toBe(13);
      expect(deleteOlderThan).toHaveBeenCalledTimes(2);
    });
  });
});
