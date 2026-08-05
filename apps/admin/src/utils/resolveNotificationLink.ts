import { type NotificationResponseInterface, NotificationTypeEnum } from '@nest-aws-starter/shared';

// Deep-links a notification into the page that shows the thing it is about,
// built from `meta` (denormalized per type by the dispatcher's builders —
// see apps/api/src/modules/notification/builders/). Only wired where meta
// genuinely carries a usable id; everything else resolves to null and the
// item renders as plain text (still marks read on click, just does not
// navigate):
//
// - WEBHOOK_FAILED: meta has `webhookEventId`/`provider`/`type`, but the
//   admin app has no webhook-detail or per-transaction-detail view/route to
//   send it to (TransactionsPage is a flat list, no row click) — building
//   one is out of scope here, so no link.
// - SUSPICIOUS_LOGIN: meta has `scope`/`value` (a lockout scope + the value
//   that tripped it — an email OR an ip, see LockoutScopeEnum), never a
//   userId. Even when scope is EMAIL, resolving that to a specific user
//   would mean an extra by-email lookup with no guarantee of a unique or
//   still-existing match — inventing that flow was judged out of scope, so
//   no link.
export function resolveNotificationLink(
  notification: NotificationResponseInterface,
): string | null {
  if (notification.type === NotificationTypeEnum.CONTACT_MESSAGE) {
    const contactMessageId: string | null = readStringMeta(notification.meta, 'contactMessageId');

    return contactMessageId ? `/inbox?messageId=${contactMessageId}` : null;
  }

  return null;
}

function readStringMeta(meta: Record<string, unknown>, key: string): string | null {
  const value: unknown = meta[key];

  return typeof value === 'string' && value.length > 0 ? value : null;
}
