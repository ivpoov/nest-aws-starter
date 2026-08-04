import type { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import type { ProviderTransactionDataInterface } from '@modules/payment/interfaces/provider-transaction-data.interface.js';

// The normalized shape every provider's verifyAndParseWebhook() must produce
// — the lifecycle service (PR 7) only ever sees this, never a raw Stripe/etc
// payload.
export interface ProviderEventInterface {
  readonly providerEventId: string;
  readonly type: NormalizedEventTypeEnum;
  readonly subscriptionRef?: string | undefined;
  readonly transactionData?: ProviderTransactionDataInterface | undefined;
  readonly periodEndsAt?: Date | undefined;
}
