import type { AdminTransactionListResponseInterface } from '@nest-aws-starter/shared';
import type { TransactionFiltersInterface } from '../../interfaces/transaction-filters.interface';
import { apiClient } from '../../utils/apiClient';

export function fetchAdminTransactions(
  limit: number,
  cursor: string | null,
  filters: TransactionFiltersInterface,
): Promise<AdminTransactionListResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) params.set('cursor', cursor);

  if (filters.userId) params.set('userId', filters.userId);

  if (filters.status) params.set('status', filters.status);

  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);

  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  return apiClient.get<AdminTransactionListResponseInterface>(
    `/admin/transactions?${params.toString()}`,
  );
}
