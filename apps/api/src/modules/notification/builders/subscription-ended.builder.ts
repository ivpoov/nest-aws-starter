import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { SubscriptionEndedReasonType } from '@modules/notification/types/subscription-ended-reason.type.js';

// Backs both subscription.canceled and subscription.expired — same
// NotificationTypeEnum.SUBSCRIPTION_ENDED member (see the matrix in
// NotificationEventSubscriberService).
export function buildSubscriptionEndedContent(
  subscriptionId: string,
  reason: SubscriptionEndedReasonType,
): NotificationContentInterface {
  return {
    title: 'Subscription ended',
    body:
      reason === 'canceled' ? 'Your subscription was canceled.' : 'Your subscription has expired.',
    meta: { subscriptionId, reason },
  };
}
