import type { NotificationInterface } from '@modules/notification/interfaces/notification.interface.js';

// A row plus the caller's own read receipt for it — null when the caller
// (the owning user, or an admin who has never marked an ADMIN-audience row)
// has not read it yet. Receipts are the reader's own: for a USER-audience
// row this is the eager receipt created at persist time; for an
// ADMIN-audience row it only exists once that admin has marked it read
// (lazy, see NotificationRepositoryInterface.markRead).
export interface NotificationListItemInterface extends NotificationInterface {
  readonly readAt: Date | null;
}
