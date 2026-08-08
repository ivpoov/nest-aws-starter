import type { CursorPaginationQueryInterface } from '../../common/interfaces/cursor-pagination-query.interface.js';
import type { NotificationAudienceEnum } from '../enums/notification-audience.enum.js';
import type { NotificationTypeEnum } from '../enums/notification-type.enum.js';

// Query contract for GET /notifications. `type`/`audience` are server-side
// filters (validated against the enums, 400 on any other value) so a
// filtered history view paginates correctly instead of filtering fetched
// pages client-side. `audience` never widens visibility: a non-admin asking
// for ADMIN rows simply gets an empty page.
export interface NotificationsQueryRequestInterface extends CursorPaginationQueryInterface {
  readonly unreadOnly?: boolean | undefined;
  readonly type?: NotificationTypeEnum | undefined;
  readonly audience?: NotificationAudienceEnum | undefined;
}
