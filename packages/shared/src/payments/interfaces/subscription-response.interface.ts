import type { SubscriptionStatusEnum } from '../enums/subscription-status.enum.js';

// Plan is embedded flat (planName/amountCents/currency) rather than nested
// under a `plan` object — this is the only place the FE needs plan display
// data alongside a subscription, and a subscription always has exactly one
// plan (FK, never null), so there's no case where nesting would express
// something flattening can't. Simpler wire shape, one less type for the FE
// to unwrap.
export interface SubscriptionResponseInterface {
  readonly id: string;
  readonly planId: string;
  readonly planName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: SubscriptionStatusEnum;
  readonly currentPeriodEndsAt: string;
  readonly canceledAt: string | null;
}
