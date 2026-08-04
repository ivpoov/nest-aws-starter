import type { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import type { TransactionFiltersInterface } from '../../interfaces/transaction-filters.interface';
import type { UseTransactionFiltersResultInterface } from '../../interfaces/use-transaction-filters-result.interface';

const EMPTY_FILTERS: TransactionFiltersInterface = {
  userId: '',
  status: null,
  dateFrom: '',
  dateTo: '',
};

export function useTransactionFilters(): UseTransactionFiltersResultInterface {
  const [filters, setFilters] = useState<TransactionFiltersInterface>(EMPTY_FILTERS);
  const [selectedUserLabel, setSelectedUserLabel] = useState<string | null>(null);

  const toggleStatus = useCallback((status: TransactionStatusEnum): void => {
    setFilters(
      (current: TransactionFiltersInterface): TransactionFiltersInterface => ({
        ...current,
        status: current.status === status ? null : status,
      }),
    );
  }, []);

  const clearStatus = useCallback((): void => {
    setFilters(
      (current: TransactionFiltersInterface): TransactionFiltersInterface => ({
        ...current,
        status: null,
      }),
    );
  }, []);

  const setDateFrom = useCallback((value: string): void => {
    setFilters(
      (current: TransactionFiltersInterface): TransactionFiltersInterface => ({
        ...current,
        dateFrom: value ? `${value}T00:00:00.000Z` : '',
      }),
    );
  }, []);

  const setDateTo = useCallback((value: string): void => {
    setFilters(
      (current: TransactionFiltersInterface): TransactionFiltersInterface => ({
        ...current,
        dateTo: value ? `${value}T23:59:59.000Z` : '',
      }),
    );
  }, []);

  const selectUser = useCallback((userId: string, label: string): void => {
    setFilters(
      (current: TransactionFiltersInterface): TransactionFiltersInterface => ({
        ...current,
        userId,
      }),
    );
    setSelectedUserLabel(label);
  }, []);

  const clearUser = useCallback((): void => {
    setFilters(
      (current: TransactionFiltersInterface): TransactionFiltersInterface => ({
        ...current,
        userId: '',
      }),
    );
    setSelectedUserLabel(null);
  }, []);

  return {
    filters,
    selectedUserLabel,
    toggleStatus,
    clearStatus,
    setDateFrom,
    setDateTo,
    selectUser,
    clearUser,
  };
}
