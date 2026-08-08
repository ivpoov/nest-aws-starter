import { NotificationTypeEnum } from '@nest-aws-starter/shared';

// Human labels for the preferences grid's rows. Covers every member of the
// wire enum (not just USER_NOTIFICATION_TYPES) so this stays a total
// mapping — the four ADMIN-only types just never appear in a matrix row.
export const NOTIFICATION_TYPE_LABELS: Record<NotificationTypeEnum, string> = {
  [NotificationTypeEnum.NEW_DEVICE_LOGIN]: 'New device sign-in',
  [NotificationTypeEnum.PASSWORD_CHANGED]: 'Password changed',
  [NotificationTypeEnum.AUTH_METHOD_CHANGED]: 'Sign-in method changed',
  [NotificationTypeEnum.SUBSCRIPTION_ACTIVATED]: 'Subscription activated',
  [NotificationTypeEnum.SUBSCRIPTION_RENEWED]: 'Subscription renewed',
  [NotificationTypeEnum.PAYMENT_FAILED]: 'Payment failed',
  [NotificationTypeEnum.SUBSCRIPTION_ENDED]: 'Subscription ended',
  [NotificationTypeEnum.USER_BLOCKED]: 'User blocked',
  [NotificationTypeEnum.SUSPICIOUS_LOGIN]: 'Suspicious login activity',
  [NotificationTypeEnum.CONTACT_MESSAGE]: 'New contact message',
  [NotificationTypeEnum.WEBHOOK_FAILED]: 'Webhook processing failed',
};
