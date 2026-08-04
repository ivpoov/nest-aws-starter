import type { ProviderTransactionDataInterface } from '@modules/payment/interfaces/provider-transaction-data.interface.js';

// Built by WebhookEventDispatcherService from a PAYMENT_SUCCEEDED
// ProviderEventInterface — provider is threaded through because
// recordRenewal looks the subscription up by the (provider, subscriptionRef)
// unique pair. recordRenewal extends Subscription.currentPeriodEndsAt and
// writes a PaymentTransaction row from transactionData in one call.
export interface RecordRenewalDataInterface {
  readonly provider: string;
  readonly subscriptionRef: string;
  readonly periodEndsAt: Date;
  readonly transactionData: ProviderTransactionDataInterface;
}
