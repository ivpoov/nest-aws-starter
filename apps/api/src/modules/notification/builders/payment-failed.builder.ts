import type { NotificationContentInterface } from '@modules/notification/interfaces/notification-content.interface.js';
import type { SubscriptionPastDuePayloadInterface } from '@modules/notification/interfaces/subscription-past-due-payload.interface.js';

// subscription.past-due -> PAYMENT_FAILED (see the matrix in task-3-brief.md).
export function buildPaymentFailedContent(
  payload: SubscriptionPastDuePayloadInterface,
): NotificationContentInterface {
  return {
    title: 'Payment failed',
    body: 'We could not process your last payment. Please update your payment method.',
    meta: { subscriptionId: payload.subscriptionId },
  };
}
