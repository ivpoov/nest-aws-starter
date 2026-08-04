import type { ActivateFromCheckoutDataInterface } from '@modules/payment/interfaces/activate-from-checkout-data.interface.js';
import type { RecordRenewalDataInterface } from '@modules/payment/interfaces/record-renewal-data.interface.js';

// The only state-transition owner for subscriptions (plan §"Global
// Constraints"). PR 6 (this consumer) is the first caller — via
// WebhookEventDispatcherService — but the contract lives here because it is
// payment-module-wide: PR 7's expiry job and later admin actions call it
// too. PR 7 implements it for real; this PR ships a no-op binding
// (NoopSubscriptionLifecycleService) so dispatch is fully testable without
// waiting on PR 7.
export interface SubscriptionLifecycleInterface {
  activateFromCheckout(data: ActivateFromCheckoutDataInterface): Promise<void>;
  recordRenewal(data: RecordRenewalDataInterface): Promise<void>;
  markPastDue(subscriptionRef: string): Promise<void>;
  // canceledAtPeriodEnd=true keeps access until currentPeriodEndsAt (user- or
  // webhook-initiated soft cancel); false is an immediate/hard cancel.
  cancel(subscriptionRef: string, canceledAtPeriodEnd: boolean): Promise<void>;
  // No webhook maps to this — PR 7's hourly expiry job calls it directly.
  expireOverdue(): Promise<void>;
}
