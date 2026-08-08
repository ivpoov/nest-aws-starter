import type { NotificationChannelEnum } from '../enums/notification-channel.enum.js';
import type { NotificationTypeEnum } from '../enums/notification-type.enum.js';

export interface UpdateNotificationPreferenceRequestInterface {
  readonly type: NotificationTypeEnum;
  readonly channel: NotificationChannelEnum;
  readonly enabled: boolean;
}
