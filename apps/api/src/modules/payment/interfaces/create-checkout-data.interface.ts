import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';

// The whole resolved plan travels in, not just its id/price-ref: a provider
// reads its own key out of plan.providerRefs and has amountCents/currency
// on hand for providers that build a one-off price instead of using a
// pre-created one. Success/cancel return URLs are intentionally absent —
// they are per-provider config (Stripe's own config module, PR 4), not a
// per-call concern here.
export interface CreateCheckoutDataInterface {
  readonly userId: string;
  readonly plan: PlanInterface;
}
