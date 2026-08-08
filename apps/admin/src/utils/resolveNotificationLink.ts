import {
  ActivityTypeEnum,
  type NotificationResponseInterface,
  NotificationTypeEnum,
} from '@nest-aws-starter/shared';

// Deep-links a notification into the page that shows the thing it is about,
// built from `meta` (denormalized per type by the dispatcher's builders —
// see apps/api/src/modules/notification/builders/). Every id is read through
// readStringMeta and encoded, so a row written by an older builder — missing
// the field, or holding a number/null — resolves to null instead of
// navigating to a route that 404s.
//
// The four ADMIN-audience types, against the meta their builders actually
// produce:
//
// - CONTACT_MESSAGE: meta.contactMessageId -> the inbox drawer.
// - USER_BLOCKED: meta.userId (the *blocked* user; the notification row
//   itself has no userId because it addresses the admin cohort) ->
//   UserDetailDrawer, which fetches by id, so a cold navigation works.
// - SUSPICIOUS_LOGIN: meta is only `scope`/`value` — a lockout scope plus
//   the email OR ip that tripped it (see LockoutScopeEnum), never a userId,
//   so there is no user to open. The activity log has a matching
//   AUTH_SUSPICIOUS_LOGIN type, which is the record of the events
//   themselves and works for both scopes -> the filtered activities page.
// - WEBHOOK_FAILED: meta has `webhookEventId`/`provider`/`type`, but the
//   admin app has no webhook-event view and the API exposes no
//   admin-facing webhook-event endpoint to build one on (the only webhook
//   route is the public provider ingest). Resolves to null until that
//   backend capability exists; the notification body already carries the
//   provider, event type and attempt count.
export function resolveNotificationLink(
  notification: NotificationResponseInterface,
): string | null {
  if (notification.type === NotificationTypeEnum.CONTACT_MESSAGE) {
    return buildIdLink('/inbox', 'messageId', notification.meta, 'contactMessageId');
  }

  if (notification.type === NotificationTypeEnum.USER_BLOCKED) {
    return buildIdLink('/users', 'userId', notification.meta, 'userId');
  }

  if (notification.type === NotificationTypeEnum.SUSPICIOUS_LOGIN) {
    return `/activities?type=${ActivityTypeEnum.AUTH_SUSPICIOUS_LOGIN}`;
  }

  return null;
}

function buildIdLink(
  path: string,
  param: string,
  meta: Record<string, unknown>,
  metaKey: string,
): string | null {
  const id: string | null = readStringMeta(meta, metaKey);

  return id ? `${path}?${param}=${encodeURIComponent(id)}` : null;
}

function readStringMeta(meta: Record<string, unknown>, key: string): string | null {
  const value: unknown = meta[key];

  return typeof value === 'string' && value.length > 0 ? value : null;
}
