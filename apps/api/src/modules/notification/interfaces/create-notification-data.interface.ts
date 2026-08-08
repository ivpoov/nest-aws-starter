import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

export interface CreateNotificationDataInterface {
  readonly audience: NotificationAudienceEnum;
  // Non-null iff audience is USER — enforced by the dispatcher, not this
  // shape (ADMIN rows address the whole cohort, not one row per admin).
  readonly userId: string | null;
  readonly type: NotificationTypeEnum;
  readonly title: string;
  readonly body: string;
  readonly meta: Record<string, unknown>;
}
