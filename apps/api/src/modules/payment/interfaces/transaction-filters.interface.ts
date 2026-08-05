import type { TransactionStatusEnum } from '@nest-aws-starter/shared';

export interface TransactionFiltersInterface {
  readonly userId?: string | null | undefined;
  readonly status?: TransactionStatusEnum | null | undefined;
  readonly dateFrom?: Date | null | undefined;
  readonly dateTo?: Date | null | undefined;
}
