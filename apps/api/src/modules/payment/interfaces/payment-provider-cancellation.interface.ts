// Optional secondary contract — a provider that can cancel a subscription
// upstream, "at period end" semantics (access continues until the current
// billing period ends — the same model this starter's local cancel already
// uses, see SubscriptionLifecycleService.cancel). PaymentProviderInterface
// itself stays untouched (verbatim-locked): a provider that doesn't
// implement this simply can't be canceled upstream — BillingService falls
// back to a local-only cancel and logs a warning. Stripe's own webhook
// (customer.subscription.updated with cancel_at_period_end) will still
// arrive afterwards and hit the already-idempotent lifecycle cancel — a
// no-op replay, not a double cancel.
export interface PaymentProviderCancellationInterface {
  cancelAtPeriodEnd(subscriptionRef: string): Promise<void>;
}
