import type { NotificationAudienceEnum } from '../enums/notification-audience.enum.js';
import type { NotificationTypeEnum } from '../enums/notification-type.enum.js';

// Wire shape for both the WS `notification` event payload and the PR 4
// history API response — denormalized (title/body/meta), no join back to
// whichever feature table triggered it (subtraction-safe). `readAt` is the
// caller's own read receipt for this row (always null on the WS push — a
// row is brand new at the moment it is emitted).
export interface NotificationResponseInterface {
  readonly id: string;
  readonly audience: NotificationAudienceEnum;
  readonly userId: string | null;
  readonly type: NotificationTypeEnum;
  readonly title: string;
  readonly body: string;
  readonly meta: Record<string, unknown>;
  readonly createdAt: string;
  readonly readAt: string | null;
}
