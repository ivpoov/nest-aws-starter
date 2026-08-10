import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import type { CreateSubscriptionDataInterface } from '@modules/payment/interfaces/create-subscription-data.interface.js';
import type { CreateSubscriptionResultInterface } from '@modules/payment/interfaces/create-subscription-result.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionStatusEnum } from '@nest-aws-starter/shared';

// On the write side, SubscriptionLifecycleService is the ONLY
// caller of updateStatus/setCanceledAt/updatePeriodEnd; every other module
// reaches subscriptions through BillingService/SubscriptionService instead.
export interface SubscriptionRepositoryInterface {
  // Latest ACTIVE or PAST_DUE subscription for the user — "current" means
  // the one billing/portal endpoints act on. CANCELED/EXPIRED rows are
  // history, not "current", even if they are the most recent row.
  findCurrentByUserId(userId: string): Promise<SubscriptionInterface | null>;
  // Most recent subscription row regardless of status — the access check
  // (SubscriptionService.hasActiveSubscription) needs to see a CANCELED row
  // that is still within its paid period, which findCurrentByUserId
  // deliberately excludes.
  findLatestByUserId(userId: string): Promise<SubscriptionInterface | null>;
  // Idempotent insert keyed on the unique [provider, providerRef] pair — a
  // replayed CHECKOUT_COMPLETED delivery resolves to the existing row
  // instead of erroring.
  createFromCheckout(
    data: CreateSubscriptionDataInterface,
  ): Promise<CreateSubscriptionResultInterface>;
  findByProviderRef(provider: string, providerRef: string): Promise<SubscriptionInterface | null>;
  // The three writers below take the optional unit-of-work handle described in
  // §7a: omit it and the statement autocommits exactly as before; pass the `tx`
  // from UnitOfWorkInterface.run and it joins that unit, so a crash between two
  // of them rolls both back instead of leaving a half-applied transition.
  //
  // Guarded extension: only writes when periodEndsAt is LATER than the
  // stored value, so a replayed renewal event can call this safely without
  // double-extending the period. Always returns the current row either way.
  updatePeriodEnd(
    id: string,
    periodEndsAt: Date,
    tx?: TransactionContextInterface,
  ): Promise<SubscriptionInterface>;
  // Raw status setter — no business rules (idempotent no-ops, valid
  // transitions, ...). Those live in SubscriptionLifecycleService; this
  // method just writes what it's told.
  updateStatus(
    id: string,
    status: SubscriptionStatusEnum,
    tx?: TransactionContextInterface,
  ): Promise<SubscriptionInterface>;
  setCanceledAt(
    id: string,
    canceledAt: Date,
    tx?: TransactionContextInterface,
  ): Promise<SubscriptionInterface>;
  // status IN (ACTIVE, PAST_DUE) AND currentPeriodEndsAt < cutoff — the
  // expiry job's sweep query; cutoff already has the grace period baked in
  // by the caller.
  findOverdue(cutoff: Date, limit: number): Promise<SubscriptionInterface[]>;
}
