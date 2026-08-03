import type { ActivityTypeEnum } from '@nest-aws-starter/shared';

export interface ActivityFiltersInterface {
  readonly userId: string;
  readonly type: ActivityTypeEnum | null;
  readonly dateFrom: string;
  readonly dateTo: string;
}
