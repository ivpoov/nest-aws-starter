import { Prisma } from '@generated/prisma/client.js';
import { TransactionStatus } from '@generated/prisma/enums.js';
import type { PaymentTransactionModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreatePaymentTransactionDataInterface } from '@modules/payment/interfaces/create-payment-transaction-data.interface.js';
import type { CreatePaymentTransactionResultInterface } from '@modules/payment/interfaces/create-payment-transaction-result.interface.js';
import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentTransactionPrismaRepository implements PaymentTransactionRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async createIdempotent(
    data: CreatePaymentTransactionDataInterface,
  ): Promise<CreatePaymentTransactionResultInterface> {
    try {
      const created: PaymentTransactionModel = await this.prisma.paymentTransaction.create({
        data: {
          userId: data.userId,
          subscriptionId: data.subscriptionId,
          status: data.status,
          amountCents: data.amountCents,
          currency: data.currency,
          provider: data.provider,
          providerRef: data.providerRef,
        },
      });

      return { transaction: this.toDomain(created), isNew: true };
    } catch (caught) {
      if (!this.isDuplicate(caught)) throw caught;

      const existing: PaymentTransactionModel =
        await this.prisma.paymentTransaction.findUniqueOrThrow({
          where: {
            provider_providerRef: { provider: data.provider, providerRef: data.providerRef },
          },
        });

      return { transaction: this.toDomain(existing), isNew: false };
    }
  }

  public async findManyByUserAfter(
    userId: string,
    pagination: CursorPaginationInterface,
  ): Promise<PaymentTransactionInterface[]> {
    const transactions: PaymentTransactionModel[] = await this.prisma.paymentTransaction.findMany({
      where: { userId },
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return transactions.map(
      (transaction: PaymentTransactionModel): PaymentTransactionInterface =>
        this.toDomain(transaction),
    );
  }

  public async findManyForAdmin(
    pagination: CursorPaginationInterface,
    filters: TransactionFiltersInterface,
  ): Promise<PaymentTransactionInterface[]> {
    const transactions: PaymentTransactionModel[] = await this.prisma.paymentTransaction.findMany({
      where: {
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.status && { status: TransactionStatus[filters.status] }),
        ...((filters.dateFrom || filters.dateTo) && {
          createdAt: {
            ...(filters.dateFrom && { gte: filters.dateFrom }),
            ...(filters.dateTo && { lte: filters.dateTo }),
          },
        }),
      },
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      orderBy: { id: 'desc' },
    });

    return transactions.map(
      (transaction: PaymentTransactionModel): PaymentTransactionInterface =>
        this.toDomain(transaction),
    );
  }

  // Same confined P2002-as-idempotency-signal extension documented in
  // webhook-event-prisma.repository.ts.
  private isDuplicate(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002';
  }

  private toDomain(transaction: PaymentTransactionModel): PaymentTransactionInterface {
    return {
      id: transaction.id,
      userId: transaction.userId,
      subscriptionId: transaction.subscriptionId,
      status: TransactionStatusEnum[transaction.status],
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      provider: transaction.provider,
      providerRef: transaction.providerRef,
      createdAt: transaction.createdAt,
    };
  }
}
