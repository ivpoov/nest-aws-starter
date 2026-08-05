import type { NotificationResponseInterface } from '@nest-aws-starter/shared';

export interface NotificationSocketStateInterface {
  readonly unreadCount: number;
  readonly liveNotifications: readonly NotificationResponseInterface[];
  readonly isConnected: boolean;
}
