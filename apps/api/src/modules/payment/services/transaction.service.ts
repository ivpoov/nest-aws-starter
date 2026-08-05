import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { PAYMENT_TRANSACTION_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import type { TransactionListInterface } from '@modules/payment/interfaces/transaction-list.interface.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class TransactionService {
  constructor(
    @Inject(PAYMENT_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: PaymentTransactionRepositoryInterface,
  ) {}

  public async findManyForUser(
    userId: string,
    pagination: CursorPaginationInterface,
  ): Promise<TransactionListInterface> {
    const items: PaymentTransactionInterface[] =
      await this.transactionRepository.findManyByUserAfter(userId, pagination);

    return this.toPage(items, pagination.limit);
  }

  public async findManyForAdmin(
    pagination: CursorPaginationInterface,
    filters: TransactionFiltersInterface,
  ): Promise<TransactionListInterface> {
    const items: PaymentTransactionInterface[] = await this.transactionRepository.findManyForAdmin(
      pagination,
      filters,
    );

    return this.toPage(items, pagination.limit);
  }

  private toPage(items: PaymentTransactionInterface[], limit: number): TransactionListInterface {
    const lastItem: PaymentTransactionInterface | undefined = items[items.length - 1];
    const nextCursor: string | null = items.length === limit && lastItem ? lastItem.id : null;

    return { items, nextCursor };
  }
}
