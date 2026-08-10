import type { ActivateFromCheckoutDataInterface } from '@modules/payment/interfaces/activate-from-checkout-data.interface.js';
import type { RecordRenewalDataInterface } from '@modules/payment/interfaces/record-renewal-data.interface.js';

// The only state-transition owner for subscriptions —
// SubscriptionLifecycleService implements this for real; every other caller
// (webhook dispatch, the expiry job, later admin actions) reaches
// subscriptions exclusively through this contract.
//
// Idempotency (binding): SQS redelivery after a
// dispatch-succeeded/markProcessed-failed race means every method below WILL
// be called twice for the same provider event. Every implementation must
// tolerate that without double-writing or double-emitting.
export interface SubscriptionLifecycleInterface {
  activateFromCheckout(data: ActivateFromCheckoutDataInterface): Promise<void>;
  recordRenewal(data: RecordRenewalDataInterface): Promise<void>;
  markPastDue(provider: string, subscriptionRef: string): Promise<void>;
  // canceledAtPeriodEnd is carried through for context/logging — this
  // starter's simplified model keeps access until currentPeriodEndsAt for
  // every cancel regardless of the flag (see SubscriptionLifecycleService
  // for the reasoning); a richer model that hard-cuts off access
  // immediately when canceledAtPeriodEnd=false is future work.
  cancel(provider: string, subscriptionRef: string, canceledAtPeriodEnd: boolean): Promise<void>;
  // SUBSCRIPTION_UPDATED with no cancellation hint (a plan swap, quantity
  // change, ...) — the only thing this starter's local row can meaningfully
  // reconcile from that event is the current period end.
  syncPeriodFromProvider(
    provider: string,
    subscriptionRef: string,
    periodEndsAt: Date,
  ): Promise<void>;
  // No webhook maps to this — the hourly expiry job calls it directly.
  expireOverdue(): Promise<void>;
}
