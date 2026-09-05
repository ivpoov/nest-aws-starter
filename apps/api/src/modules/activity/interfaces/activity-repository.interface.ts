import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { ActivityInterface } from '@modules/activity/interfaces/activity.interface.js';
import type { ActivityFiltersInterface } from '@modules/activity/interfaces/activity-filters.interface.js';
import type { CreateActivityDataInterface } from '@modules/activity/interfaces/create-activity-data.interface.js';

// Append-only contract: create + cursor list, and NO UPDATE, ever. A recorded
// activity is never edited, because an audit trail that can be rewritten is not
// one.
//
// Deletion is permitted in exactly one form — by age, in bulk, from retention.
// That is not a hole in the contract: keeping a row forever is also a policy,
// and it is the one that ends with the fastest-growing table in the schema
// holding a decade of rows nobody can query. What stays forbidden is deleting a
// SPECIFIC activity, which is what would let the trail be doctored.
export interface ActivityRepositoryInterface {
  create(data: CreateActivityDataInterface): Promise<ActivityInterface>;
  deleteOlderThan(cutoff: Date, limit: number): Promise<number>;
  findManyAfter(
    pagination: CursorPaginationInterface,
    filters: ActivityFiltersInterface,
  ): Promise<ActivityInterface[]>;
}
