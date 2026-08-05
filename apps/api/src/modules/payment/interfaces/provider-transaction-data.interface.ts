import type { TransactionStatusEnum } from '@nest-aws-starter/shared';

// Carried on PAYMENT_SUCCEEDED/PAYMENT_FAILED provider events — enough for
// the PR 7 lifecycle service to write a PaymentTransaction row without
// reaching back into the provider's raw payload.
export interface ProviderTransactionDataInterface {
  readonly providerRef: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: TransactionStatusEnum;
}
