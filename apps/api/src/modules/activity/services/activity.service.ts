import { type RetentionConfig, retentionConfig } from '@configs/retention.config.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { ACTIVITY_REPOSITORY } from '@modules/activity/constants/activity.constants.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { ActivityListInterface } from '@modules/activity/interfaces/activity-list.interface.js';
import type { ActivityRepositoryInterface } from '@modules/activity/interfaces/activity-repository.interface.js';
import type { CreateActivityDataInterface } from '@modules/activity/interfaces/create-activity-data.interface.js';
import { purgeInBatches } from '@modules/common/helpers/purge-in-batches.helper.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Inject, Injectable } from '@nestjs/common';

const DAY_MS = 86_400_000;

@Injectable()
export class ActivityService {
  private readonly logger = new CustomLoggerService(ActivityService.name);

  constructor(
    @Inject(ACTIVITY_REPOSITORY)
    private readonly activityRepository: ActivityRepositoryInterface,
    @Inject(retentionConfig.KEY) private readonly retention: RetentionConfig,
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

  // Retention. Disabled by RETENTION_ENABLED, and otherwise deletes rows
  // created before the configured window in bounded batches — see
  // purgeInBatches for why the loop is capped as well as batched.
  public async purgeExpired(): Promise<number> {
    if (!this.retention.isEnabled) return 0;

    const cutoff: Date = new Date(Date.now() - this.retention.activityDays * DAY_MS);

    return purgeInBatches('activity', this.retention.batchSize, this.logger, (limit: number) =>
      this.activityRepository.deleteOlderThan(cutoff, limit),
    );
  }
}
