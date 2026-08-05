import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';

// Same isNew idiom as CreateSubscriptionResultInterface — the P2002 catch
// (unique [provider, providerRef]) on a replayed PAYMENT_SUCCEEDED webhook
// resolves to the existing row instead of erroring, and this flag is what
// tells SubscriptionLifecycleService.recordRenewal not to double-extend the
// period or re-emit SUBSCRIPTION_RENEWED.
export interface CreatePaymentTransactionResultInterface {
  readonly transaction: PaymentTransactionInterface;
  readonly isNew: boolean;
}
