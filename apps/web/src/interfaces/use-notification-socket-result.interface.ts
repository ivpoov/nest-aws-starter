import type { NotificationResponseInterface } from '@nest-aws-starter/shared';

export interface UseNotificationSocketResultInterface {
  readonly unreadCount: number;
  readonly liveNotifications: readonly NotificationResponseInterface[];
  readonly isConnected: boolean;
  readonly adjustUnreadCount: (delta: number) => void;
}
