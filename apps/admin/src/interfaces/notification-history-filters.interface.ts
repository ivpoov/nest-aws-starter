import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

// Client-side only: GET /notifications has no type/audience query params
// (just cursor/limit/unreadOnly — see notification.controller.ts), so these
// filters are applied to each fetched page in useNotificationList rather
// than sent as request params. `hasMore` therefore still reflects the raw
// (unfiltered) cursor — a heavily filtered view may need several
// "Load more" clicks before another match surfaces.
export interface NotificationHistoryFiltersInterface {
  readonly type: NotificationTypeEnum | null;
  readonly audience: NotificationAudienceEnum | null;
}
