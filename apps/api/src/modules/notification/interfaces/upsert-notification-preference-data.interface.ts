import type { NotificationChannelEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

export interface UpsertNotificationPreferenceDataInterface {
  readonly type: NotificationTypeEnum;
  readonly channel: NotificationChannelEnum;
  readonly enabled: boolean;
}
