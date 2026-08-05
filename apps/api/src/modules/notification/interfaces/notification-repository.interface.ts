import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreateNotificationDataInterface } from '@modules/notification/interfaces/create-notification-data.interface.js';
import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';
import type { NotificationListFiltersInterface } from '@modules/notification/interfaces/notification-list-filters.interface.js';
import type { NotificationListItemInterface } from '@modules/notification/interfaces/notification-list-item.interface.js';
import type { NotificationScopeFiltersInterface } from '@modules/notification/interfaces/notification-scope-filters.interface.js';

export interface NotificationRepositoryInterface {
  // USER audience: the row and its single reader receipt are created
  // together (eager). ADMIN audience: only the row — one per admin cohort,
  // never fanned out into per-admin receipts (those are created lazily by
  // markRead/markAllRead, PR 4's history API — see notification.service.ts).
  create(data: CreateNotificationDataInterface): Promise<NotificationInterface>;
  findById(id: string): Promise<NotificationInterface | null>;
  findManyAfter(
    pagination: CursorPaginationInterface,
    filters: NotificationListFiltersInterface,
  ): Promise<NotificationListItemInterface[]>;
  countUnread(filters: NotificationScopeFiltersInterface): Promise<number>;
  // Idempotent no-op if the reader already has a read receipt for this row —
  // otherwise creates one (lazy for ADMIN-audience rows) or flips the
  // existing eager USER receipt's readAt.
  markRead(notificationId: string, readerId: string): Promise<void>;
  markAllRead(filters: NotificationScopeFiltersInterface): Promise<void>;
}
