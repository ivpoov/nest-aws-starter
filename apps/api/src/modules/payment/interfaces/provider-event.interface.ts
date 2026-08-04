import type { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import type { CheckoutEventDataInterface } from '@modules/payment/interfaces/checkout-event-data.interface.js';
import type { ProviderTransactionDataInterface } from '@modules/payment/interfaces/provider-transaction-data.interface.js';

// The normalized shape every provider's verifyAndParseWebhook() must produce
// — the lifecycle service (PR 7) only ever sees this, never a raw Stripe/etc
// payload. checkoutData/canceledAtPeriodEnd added in PR 4 (Stripe): a
// CHECKOUT_COMPLETED event needs somewhere to carry the userId/planId/
// customerRef the lifecycle service will persist, and SUBSCRIPTION_UPDATED
// needs a minimal cancellation hint — both optional so providers that never
// emit them (or other event types) leave them undefined.
export interface ProviderEventInterface {
  readonly providerEventId: string;
  readonly type: NormalizedEventTypeEnum;
  readonly subscriptionRef?: string | undefined;
  readonly transactionData?: ProviderTransactionDataInterface | undefined;
  readonly periodEndsAt?: Date | undefined;
  readonly checkoutData?: CheckoutEventDataInterface | undefined;
  readonly canceledAtPeriodEnd?: boolean | undefined;
}
