import type { ActivityTypeEnum } from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import type { ActivityFiltersInterface } from '../../interfaces/activity-filters.interface';
import type { UseActivityFiltersResultInterface } from '../../interfaces/use-activity-filters-result.interface';

const EMPTY_FILTERS: ActivityFiltersInterface = {
  userId: '',
  type: null,
  dateFrom: '',
  dateTo: '',
};

export function useActivityFilters(): UseActivityFiltersResultInterface {
  const [filters, setFilters] = useState<ActivityFiltersInterface>(EMPTY_FILTERS);
  const [selectedUserLabel, setSelectedUserLabel] = useState<string | null>(null);

  const toggleType = useCallback((type: ActivityTypeEnum): void => {
    setFilters(
      (current: ActivityFiltersInterface): ActivityFiltersInterface => ({
        ...current,
        type: current.type === type ? null : type,
      }),
    );
  }, []);

  const clearType = useCallback((): void => {
    setFilters(
      (current: ActivityFiltersInterface): ActivityFiltersInterface => ({ ...current, type: null }),
    );
  }, []);

  const setDateFrom = useCallback((value: string): void => {
    setFilters(
      (current: ActivityFiltersInterface): ActivityFiltersInterface => ({
        ...current,
        dateFrom: value ? `${value}T00:00:00.000Z` : '',
      }),
    );
  }, []);

  const setDateTo = useCallback((value: string): void => {
    setFilters(
      (current: ActivityFiltersInterface): ActivityFiltersInterface => ({
        ...current,
        dateTo: value ? `${value}T23:59:59.000Z` : '',
      }),
    );
  }, []);

  const selectUser = useCallback((userId: string, label: string): void => {
    setFilters(
      (current: ActivityFiltersInterface): ActivityFiltersInterface => ({ ...current, userId }),
    );
    setSelectedUserLabel(label);
  }, []);

  const clearUser = useCallback((): void => {
    setFilters(
      (current: ActivityFiltersInterface): ActivityFiltersInterface => ({ ...current, userId: '' }),
    );
    setSelectedUserLabel(null);
  }, []);

  return {
    filters,
    selectedUserLabel,
    toggleType,
    clearType,
    setDateFrom,
    setDateTo,
    selectUser,
    clearUser,
  };
}
