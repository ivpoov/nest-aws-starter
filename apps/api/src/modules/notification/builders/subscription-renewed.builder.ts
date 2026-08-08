import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { SubscriptionRenewedPayloadInterface } from '@modules/notification/interfaces/subscription-renewed-payload.interface.js';

export function buildSubscriptionRenewedContent(
  payload: SubscriptionRenewedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Subscription renewed',
    body: 'Your subscription was renewed.',
    meta: { subscriptionId: payload.subscriptionId },
  };
}
