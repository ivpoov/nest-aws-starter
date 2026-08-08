import { NotificationTypeEnum } from '@nest-aws-starter/shared';

// Every USER-audience type the dispatcher emits (see
// notification-dispatcher.service.ts's matrix) — the only types a
// per-user preference can mean anything for. ADMIN-audience types
// (USER_BLOCKED, SUSPICIOUS_LOGIN, CONTACT_MESSAGE, WEBHOOK_FAILED) have
// no per-user recipient and are deliberately excluded from the matrix:
// email for those is out of scope for this release.
export const USER_NOTIFICATION_TYPES: readonly NotificationTypeEnum[] = [
  NotificationTypeEnum.NEW_DEVICE_LOGIN,
  NotificationTypeEnum.PASSWORD_CHANGED,
  NotificationTypeEnum.AUTH_METHOD_CHANGED,
  NotificationTypeEnum.SUBSCRIPTION_ACTIVATED,
  NotificationTypeEnum.SUBSCRIPTION_RENEWED,
  NotificationTypeEnum.PAYMENT_FAILED,
  NotificationTypeEnum.SUBSCRIPTION_ENDED,
];

// Single source of truth for the "no stored row yet" default (task-5-brief.md:
// "all EMAIL on except SUBSCRIPTION_RENEWED (noise)"). Every other
// USER_NOTIFICATION_TYPES member defaults to EMAIL on. IN_APP has no entry
// here — it is always on and never reads this map (see
// NotificationPreferenceService).
export const DEFAULT_EMAIL_DISABLED_TYPES: ReadonlySet<NotificationTypeEnum> = new Set([
  NotificationTypeEnum.SUBSCRIPTION_RENEWED,
]);
