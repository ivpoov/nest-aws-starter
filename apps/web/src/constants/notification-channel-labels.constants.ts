import { NotificationChannelEnum } from '@nest-aws-starter/shared';

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannelEnum, string> = {
  [NotificationChannelEnum.IN_APP]: 'In-app',
  [NotificationChannelEnum.EMAIL]: 'Email',
};
