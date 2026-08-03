import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityRepositoryInterface } from '@modules/activity/interfaces/activity-repository.interface.js';
import { ActivityService } from '@modules/activity/services/activity.service.js';
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
}

function createService(overrides: Partial<ActivityRepositoryInterface> = {}): TestSetupInterface {
  const repository: ActivityRepositoryInterface = {
    create: vi.fn().mockResolvedValue(activity),
    findManyAfter: vi.fn().mockResolvedValue([activity]),
    ...overrides,
  };
  const service: ActivityService = new ActivityService(repository);

  return { service, repository };
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
    const secondActivity: ActivityInterface = { ...activity, id: '01890a5d-ac96-774b-bcce-b302099a9999' };
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
    });
    const shortPage = await shortService.findMany(pagination, filters);

    expect(shortPage.nextCursor).toBeNull();
  });
});
