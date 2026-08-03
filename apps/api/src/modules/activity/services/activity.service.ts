import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { ACTIVITY_REPOSITORY } from '@modules/activity/constants/activity.constants.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityListInterface } from '@modules/activity/interfaces/activity-list.interface.js';
import type { ActivityRepositoryInterface } from '@modules/activity/interfaces/activity-repository.interface.js';
import type { CreateActivityDataInterface } from '@modules/activity/interfaces/create-activity-data.interface.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class ActivityService {
  private readonly logger = new CustomLoggerService(ActivityService.name);

  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: ActivityRepositoryInterface,
  ) {}

  // The only write path — feature services never call this directly, they
  // emit domain events and the activity module's subscribers call record().
  public async record(data: CreateActivityDataInterface): Promise<ActivityInterface> {
    const activity: ActivityInterface = await this.activityRepository.create(data);

    this.logger.debug(`Activity recorded: ${activity.type} (${activity.id})`);

    return activity;
  }

  public async findMany(
    pagination: CursorPaginationInterface,
    filters: ActivityFiltersInterface,
  ): Promise<ActivityListInterface> {
    const items: ActivityInterface[] = await this.activityRepository.findManyAfter(
      pagination,
      filters,
    );
    const lastItem: ActivityInterface | undefined = items[items.length - 1];
    const nextCursor: string | null =
      items.length === pagination.limit && lastItem ? lastItem.id : null;

    return { items, nextCursor };
  }
}
