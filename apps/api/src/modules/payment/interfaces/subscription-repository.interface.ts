import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';

// Deliberately minimal — this PR only reads. Subscription creation/transition
// is owned by the lifecycle service arriving in PR 7, which will add its own
// write methods here (create, updateStatus, setProviderCustomerRef, ...).
export interface SubscriptionRepositoryInterface {
  // Latest ACTIVE or PAST_DUE subscription for the user — "current" means
  // the one billing/portal endpoints act on. CANCELED/EXPIRED rows are
  // history, not "current", even if they are the most recent row.
  findCurrentByUserId(userId: string): Promise<SubscriptionInterface | null>;
}
