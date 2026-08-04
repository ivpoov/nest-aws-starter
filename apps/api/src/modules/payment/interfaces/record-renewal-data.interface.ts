import type { ProviderTransactionDataInterface } from '@modules/payment/interfaces/provider-transaction-data.interface.js';

// Built by WebhookEventDispatcherService from a PAYMENT_SUCCEEDED
// ProviderEventInterface — PR 7's recordRenewal extends
// Subscription.currentPeriodEndsAt and writes a PaymentTransaction row from
// transactionData in one call.
export interface RecordRenewalDataInterface {
  readonly subscriptionRef: string;
  readonly periodEndsAt: Date;
  readonly transactionData: ProviderTransactionDataInterface;
}
