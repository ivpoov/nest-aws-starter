import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { TransactionStatusEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for admin transaction reads.
export class TransactionEntity implements PaymentTransactionInterface {
  declare readonly id: string;
  declare readonly userId: string;
  declare readonly subscriptionId: string | null;
  declare readonly status: TransactionStatusEnum;
  declare readonly amountCents: number;
  declare readonly currency: string;
  declare readonly provider: string;
  declare readonly providerRef: string;
  declare readonly createdAt: Date;
}
