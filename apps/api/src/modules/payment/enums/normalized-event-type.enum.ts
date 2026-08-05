// Every provider webhook (Stripe today, others later) is translated into one
// of these before it ever reaches the lifecycle service — nothing downstream
// of the provider's own module knows a specific provider's event names exist.
export enum NormalizedEventTypeEnum {
  CHECKOUT_COMPLETED = 'CHECKOUT_COMPLETED',
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SUBSCRIPTION_UPDATED = 'SUBSCRIPTION_UPDATED',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  UNHANDLED = 'UNHANDLED',
}
