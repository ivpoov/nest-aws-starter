import type {
  NotificationListResponseInterface,
  NotificationPreferencesResponseInterface,
  UnreadCountResponseInterface,
  UpdateNotificationPreferencesRequestInterface,
} from '@nest-aws-starter/shared';
import type { FetchNotificationsParamsInterface } from '../../interfaces/fetch-notifications-params.interface';
import { apiClient } from '../../utils/apiClient';

export function fetchNotifications(
  params: FetchNotificationsParamsInterface,
): Promise<NotificationListResponseInterface> {
  const query: URLSearchParams = new URLSearchParams();

  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.unreadOnly) query.set('unreadOnly', 'true');

  const queryString: string = query.toString();

  return apiClient.get<NotificationListResponseInterface>(
    `/notifications${queryString ? `?${queryString}` : ''}`,
  );
}

export function fetchUnreadCount(): Promise<UnreadCountResponseInterface> {
  return apiClient.get<UnreadCountResponseInterface>('/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<void> {
  return apiClient.patch<void>(`/notifications/${id}/read`, undefined);
}

export function markAllNotificationsRead(): Promise<void> {
  return apiClient.post<void>('/notifications/read-all');
}

export function fetchNotificationPreferences(): Promise<NotificationPreferencesResponseInterface> {
  return apiClient.get<NotificationPreferencesResponseInterface>('/notifications/preferences');
}

export function updateNotificationPreferences(
  body: UpdateNotificationPreferencesRequestInterface,
): Promise<void> {
  return apiClient.put<void>('/notifications/preferences', body);
}
