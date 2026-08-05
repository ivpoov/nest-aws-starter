import type { NotificationListItemInterface } from '@modules/notification/interfaces/notification-list-item.interface.js';

export interface NotificationListInterface {
  readonly items: NotificationListItemInterface[];
  readonly nextCursor: string | null;
}
