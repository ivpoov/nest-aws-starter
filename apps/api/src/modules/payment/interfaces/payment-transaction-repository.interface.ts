import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreatePaymentTransactionDataInterface } from '@modules/payment/interfaces/create-payment-transaction-data.interface.js';
import type { CreatePaymentTransactionResultInterface } from '@modules/payment/interfaces/create-payment-transaction-result.interface.js';
import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';

export interface PaymentTransactionRepositoryInterface {
  createIdempotent(
    data: CreatePaymentTransactionDataInterface,
  ): Promise<CreatePaymentTransactionResultInterface>;
  // Own-transactions read — scoped by userId, no filters (the caller can
  // only ever see their own rows).
  findManyByUserAfter(
    userId: string,
    pagination: CursorPaginationInterface,
  ): Promise<PaymentTransactionInterface[]>;
  // Admin read — same cursor+filters shape as ActivityRepositoryInterface.findManyAfter.
  findManyForAdmin(
    pagination: CursorPaginationInterface,
    filters: TransactionFiltersInterface,
  ): Promise<PaymentTransactionInterface[]>;
}
