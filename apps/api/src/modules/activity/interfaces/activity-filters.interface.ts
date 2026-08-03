import type { ActivityTypeEnum } from '@nest-aws-starter/shared';

export interface ActivityFiltersInterface {
  readonly userId?: string | null | undefined;
  readonly type?: ActivityTypeEnum | null | undefined;
  readonly dateFrom?: Date | null | undefined;
  readonly dateTo?: Date | null | undefined;
}
