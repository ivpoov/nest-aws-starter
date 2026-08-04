import type { TransactionStatusEnum } from '@nest-aws-starter/shared';

export interface TransactionFiltersInterface {
  readonly userId: string;
  readonly status: TransactionStatusEnum | null;
  readonly dateFrom: string;
  readonly dateTo: string;
}
