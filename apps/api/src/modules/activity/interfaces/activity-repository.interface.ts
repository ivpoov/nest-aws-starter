import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { CreateActivityDataInterface } from '@modules/activity/interfaces/create-activity-data.interface.js';

// Append-only contract: create + cursor list only — no update, no delete.
export interface ActivityRepositoryInterface {
  create(data: CreateActivityDataInterface): Promise<ActivityInterface>;
  findManyAfter(
    pagination: CursorPaginationInterface,
    filters: ActivityFiltersInterface,
  ): Promise<ActivityInterface[]>;
}
