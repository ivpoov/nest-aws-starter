import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import type { NotificationHistoryFiltersInterface } from '../../interfaces/notification-history-filters.interface';
import type { UseNotificationHistoryFiltersResultInterface } from '../../interfaces/use-notification-history-filters-result.interface';

const EMPTY_FILTERS: NotificationHistoryFiltersInterface = {
  type: null,
  audience: null,
};

export function useNotificationHistoryFilters(): UseNotificationHistoryFiltersResultInterface {
  const [filters, setFilters] = useState<NotificationHistoryFiltersInterface>(EMPTY_FILTERS);

  const toggleType = useCallback((type: NotificationTypeEnum): void => {
    setFilters(
      (current: NotificationHistoryFiltersInterface): NotificationHistoryFiltersInterface => ({
        ...current,
        type: current.type === type ? null : type,
      }),
    );
  }, []);

  const clearType = useCallback((): void => {
    setFilters(
      (current: NotificationHistoryFiltersInterface): NotificationHistoryFiltersInterface => ({
        ...current,
        type: null,
      }),
    );
  }, []);

  const toggleAudience = useCallback((audience: NotificationAudienceEnum): void => {
    setFilters(
      (current: NotificationHistoryFiltersInterface): NotificationHistoryFiltersInterface => ({
        ...current,
        audience: current.audience === audience ? null : audience,
      }),
    );
  }, []);

  const clearAudience = useCallback((): void => {
    setFilters(
      (current: NotificationHistoryFiltersInterface): NotificationHistoryFiltersInterface => ({
        ...current,
        audience: null,
      }),
    );
  }, []);

  return { filters, toggleType, clearType, toggleAudience, clearAudience };
}
