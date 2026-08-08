// Backs the Prisma Notification.type VarChar(60) column — the DB stores the
// string value, this enum is the source of truth at the wire level. Members
// cover the PR 3 dispatcher's initial event-to-notification matrix; new
// notification types extend this enum, they never invent an untyped string.
export enum NotificationTypeEnum {
  NEW_DEVICE_LOGIN = 'NEW_DEVICE_LOGIN',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  AUTH_METHOD_CHANGED = 'AUTH_METHOD_CHANGED',
  SUBSCRIPTION_ACTIVATED = 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_RENEWED = 'SUBSCRIPTION_RENEWED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SUBSCRIPTION_ENDED = 'SUBSCRIPTION_ENDED',
  USER_BLOCKED = 'USER_BLOCKED',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  CONTACT_MESSAGE = 'CONTACT_MESSAGE',
  WEBHOOK_FAILED = 'WEBHOOK_FAILED',
}
