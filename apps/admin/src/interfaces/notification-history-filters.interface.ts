import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

// Filter-bar state for the history page. Every field maps 1:1 onto a
// server-side query param of GET /notifications (see
// NotificationsQueryRequestInterface in packages/shared), so the API returns
// an already-filtered page and `nextCursor`/`hasMore` describe the *filtered*
// result set. `null` (type/audience) and `false` (unreadOnly) mean "All" and
// are sent as an absent param, matching the API defaults.
//
// `audience` narrows, never widens: an admin asking for USER sees only their
// own rows, and a non-admin asking for ADMIN gets an empty page rather than a
// 403 — visibility is still resolved from the caller's role server-side.
export interface NotificationHistoryFiltersInterface {
  readonly type: NotificationTypeEnum | null;
  readonly audience: NotificationAudienceEnum | null;
  readonly unreadOnly: boolean;
}
