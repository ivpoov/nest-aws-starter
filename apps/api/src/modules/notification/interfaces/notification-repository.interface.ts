import type { CreateNotificationDataInterface } from '@modules/notification/interfaces/create-notification-data.interface.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';

export interface NotificationRepositoryInterface {
  // USER audience: the row and its single reader receipt are created
  // together (eager). ADMIN audience: only the row — one per admin cohort,
  // never fanned out into per-admin receipts (those are created lazily on
  // first fetch, per the Task 1 schema note — PR 4's concern).
  create(data: CreateNotificationDataInterface): Promise<NotificationInterface>;
}
