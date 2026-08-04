import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';

export interface TransactionListInterface {
  readonly items: PaymentTransactionInterface[];
  readonly nextCursor: string | null;
}
