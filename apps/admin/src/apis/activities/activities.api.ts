import type { ActivityListResponseInterface } from '@nest-aws-starter/shared';
import type { ActivityFiltersInterface } from '../../interfaces/activity-filters.interface';
import { apiClient } from '../../utils/apiClient';

export function fetchAdminActivities(
  limit: number,
  cursor: string | null,
  filters: ActivityFiltersInterface,
): Promise<ActivityListResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) params.set('cursor', cursor);

  if (filters.userId) params.set('userId', filters.userId);

  if (filters.type) params.set('type', filters.type);

  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);

  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  return apiClient.get<ActivityListResponseInterface>(`/admin/activities?${params.toString()}`);
}

export function fetchUserActivities(
  userId: string,
  limit: number,
  cursor: string | null,
): Promise<ActivityListResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ limit: String(limit) });

  if (cursor) params.set('cursor', cursor);

  return apiClient.get<ActivityListResponseInterface>(
    `/admin/users/${userId}/activities?${params.toString()}`,
  );
}
