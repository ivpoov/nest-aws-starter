import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { SubscriptionActivatedPayloadInterface } from '@modules/notification/interfaces/subscription-activated-payload.interface.js';

export function buildSubscriptionActivatedContent(
  payload: SubscriptionActivatedPayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Subscription activated',
    body: 'Your subscription is now active.',
    meta: { subscriptionId: payload.subscriptionId, planId: payload.planId },
  };
}
