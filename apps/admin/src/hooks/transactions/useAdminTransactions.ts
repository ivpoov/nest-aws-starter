import type {
  AdminTransactionResponseInterface,
  ApiErrorInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminTransactions } from '../../apis/transactions';
import type { TransactionFiltersInterface } from '../../interfaces/transaction-filters.interface';
import type { UseTransactionListResultInterface } from '../../interfaces/use-transaction-list-result.interface';
import { toApiError } from '../../utils/toApiError';

const PAGE_SIZE = 20;

export function useAdminTransactions(
  filters: TransactionFiltersInterface,
): UseTransactionListResultInterface {
  const [transactions, setTransactions] = useState<AdminTransactionResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const cursorRef = useRef<string | null>(null);

  const loadPage = useCallback(
    async (isFresh: boolean): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const cursor: string | null = isFresh ? null : cursorRef.current;
        const page = await fetchAdminTransactions(PAGE_SIZE, cursor, filters);

        cursorRef.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
        setTransactions(
          (current: AdminTransactionResponseInterface[]): AdminTransactionResponseInterface[] =>
            isFresh ? page.items : [...current, ...page.items],
        );
      } catch (caught) {
        setError(toApiError(caught));
      } finally {
        setIsLoading(false);
      }
    },
    [filters],
  );

  const loadMore = useCallback(async (): Promise<void> => loadPage(false), [loadPage]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  return { transactions, hasMore, isLoading, error, loadMore };
}
