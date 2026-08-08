import type {
  NotificationListResponseInterface,
  NotificationPreferencesResponseInterface,
  NotificationsQueryRequestInterface,
  UnreadCountResponseInterface,
  UpdateNotificationPreferencesRequestInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

// Params are the shared wire contract verbatim
// (NotificationsQueryRequestInterface), not an app-local restatement of it.
// Every "off" filter is omitted rather than sent as a falsy value: the DTO
// treats only the literal string 'true' as unreadOnly=true, and rejects any
// value outside NotificationTypeEnum / NotificationAudienceEnum with a 400,
// so `type=` or `unreadOnly=false` would be a worse request than no param.
export function fetchNotifications(
  params: NotificationsQueryRequestInterface,
): Promise<NotificationListResponseInterface> {
  const query: URLSearchParams = new URLSearchParams();

  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.unreadOnly) query.set('unreadOnly', 'true');
  if (params.type) query.set('type', params.type);
  if (params.audience) query.set('audience', params.audience);

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
