import type {
  AdminTransactionResponseInterface,
  ApiErrorInterface,
} from '@nest-aws-starter/shared';

export interface UseTransactionListResultInterface {
  readonly transactions: AdminTransactionResponseInterface[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
}
