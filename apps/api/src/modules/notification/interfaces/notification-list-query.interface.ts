import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

// The caller-supplied list filters (GET /notifications query params) —
// combined with the role-derived visibility scope in
// NotificationListFiltersInterface. `audience` only ever narrows the scope,
// it never widens it: a non-admin filtering on ADMIN gets an empty page.
export interface NotificationListQueryInterface {
  readonly unreadOnly: boolean;
  readonly type?: NotificationTypeEnum | undefined;
  readonly audience?: NotificationAudienceEnum | undefined;
}
