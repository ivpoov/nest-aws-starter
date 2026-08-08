import type { NotificationAudienceEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';

export interface NotificationInterface {
  readonly id: string;
  readonly audience: NotificationAudienceEnum;
  readonly userId: string | null;
  readonly type: NotificationTypeEnum;
  readonly title: string;
  readonly body: string;
  readonly meta: Record<string, unknown>;
  readonly createdAt: Date;
}
