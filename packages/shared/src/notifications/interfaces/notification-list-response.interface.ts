import type { NotificationResponseInterface } from './notification-response.interface.js';

export interface NotificationListResponseInterface {
  readonly items: NotificationResponseInterface[];
  readonly nextCursor: string | null;
}
