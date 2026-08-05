import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

export interface DispatchInputInterface {
  readonly audience: NotificationAudienceEnum;
  readonly userId: string | null;
  readonly type: NotificationTypeEnum;
  readonly content: NotificationContentInterface;
}
