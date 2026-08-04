import type { CreatePaymentTransactionDataInterface } from '@modules/payment/interfaces/create-payment-transaction-data.interface.js';
import type { CreatePaymentTransactionResultInterface } from '@modules/payment/interfaces/create-payment-transaction-result.interface.js';

// Deliberately minimal — PR 10 (revenue reporting) adds read methods here
// once it needs them. This PR only needs the idempotent write.
export interface PaymentTransactionRepositoryInterface {
  createIdempotent(
    data: CreatePaymentTransactionDataInterface,
  ): Promise<CreatePaymentTransactionResultInterface>;
}
