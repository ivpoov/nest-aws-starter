import type { SubscriptionStatusEnum } from '@nest-aws-starter/shared';

// planName/amountCents/currency are embedded flat rather than nested (a
// `plan: PlanInterface`): this is the "current subscription" read model, the
// only shape the repository produces for it, and it is joined straight off
// Subscription→Plan in one query — no second lookup, no risk of the two
// falling out of sync mid-request. A future richer read model (e.g. history)
// can define its own interface without touching this one.
export interface SubscriptionInterface {
  readonly id: string;
  readonly userId: string;
  readonly planId: string;
  readonly planName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: SubscriptionStatusEnum;
  readonly provider: string;
  readonly providerRef: string | null;
  readonly providerCustomerRef: string | null;
  readonly currentPeriodEndsAt: Date;
  readonly canceledAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
