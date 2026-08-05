import type { TransactionStatusEnum } from '@nest-aws-starter/shared';
import type { TransactionFiltersInterface } from './transaction-filters.interface';

export interface UseTransactionFiltersResultInterface {
  readonly filters: TransactionFiltersInterface;
  readonly selectedUserLabel: string | null;
  readonly toggleStatus: (status: TransactionStatusEnum) => void;
  readonly clearStatus: () => void;
  readonly setDateFrom: (value: string) => void;
  readonly setDateTo: (value: string) => void;
  readonly selectUser: (userId: string, label: string) => void;
  readonly clearUser: () => void;
}
