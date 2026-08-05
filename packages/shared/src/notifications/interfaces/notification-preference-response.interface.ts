import type { NotificationChannelEnum } from '../enums/notification-channel.enum.js';
import type { NotificationTypeEnum } from '../enums/notification-type.enum.js';

// One cell of the full type x channel matrix, with defaults already merged
// in — the client never needs to know the default rules.
export interface NotificationPreferenceResponseInterface {
  readonly type: NotificationTypeEnum;
  readonly channel: NotificationChannelEnum;
  readonly enabled: boolean;
  readonly isEditable: boolean;
}
