import { NotificationTypeEnum } from '@nest-aws-starter/shared';

// Every route a notification type can deep-link into, in apps/web itself —
// there is no per-id detail page for any of these, so the target is a
// static settings route, never something built out of `meta`. Types with
// no route (including the four ADMIN-audience types, which never surface
// here — apps/web has no admin section) resolve to null: the item still
// marks read on click, it just does not navigate.
const NOTIFICATION_LINKS: Partial<Record<NotificationTypeEnum, string>> = {
  [NotificationTypeEnum.PAYMENT_FAILED]: '/settings/billing',
  [NotificationTypeEnum.SUBSCRIPTION_ACTIVATED]: '/settings/billing',
  [NotificationTypeEnum.SUBSCRIPTION_RENEWED]: '/settings/billing',
  [NotificationTypeEnum.SUBSCRIPTION_ENDED]: '/settings/billing',
  [NotificationTypeEnum.AUTH_METHOD_CHANGED]: '/settings/methods',
  [NotificationTypeEnum.NEW_DEVICE_LOGIN]: '/settings/sessions',
  // The body tells the user to secure the account if the change was not
  // theirs, and the sessions page is where they do it (meta carries a
  // sessionId, but there is no per-session route to target with it).
  [NotificationTypeEnum.PASSWORD_CHANGED]: '/settings/sessions',
};

export function resolveNotificationLink(type: NotificationTypeEnum): string | null {
  return NOTIFICATION_LINKS[type] ?? null;
}
