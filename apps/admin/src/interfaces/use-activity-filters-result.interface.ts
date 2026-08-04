import type { ActivityTypeEnum } from '@nest-aws-starter/shared';
import type { ActivityFiltersInterface } from './activity-filters.interface';

export interface UseActivityFiltersResultInterface {
  readonly filters: ActivityFiltersInterface;
  readonly selectedUserLabel: string | null;
  readonly toggleType: (type: ActivityTypeEnum) => void;
  readonly clearType: () => void;
  readonly setDateFrom: (value: string) => void;
  readonly setDateTo: (value: string) => void;
  readonly selectUser: (userId: string, label: string) => void;
  readonly clearUser: () => void;
}
