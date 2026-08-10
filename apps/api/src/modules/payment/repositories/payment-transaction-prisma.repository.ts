import type { Prisma } from '@generated/prisma/client.js';
import { TransactionStatus } from '@generated/prisma/enums.js';
import type { PaymentTransactionModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import type { CreatePaymentTransactionDataInterface } from '@modules/payment/interfaces/create-payment-transaction-data.interface.js';
import type { CreatePaymentTransactionResultInterface } from '@modules/payment/interfaces/create-payment-transaction-result.interface.js';
import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import { resolvePrismaClient } from '@modules/prisma/helpers/prisma-transaction-registry.helper.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentTransactionPrismaRepository implements PaymentTransactionRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  // Conflict-free idempotent insert: `createMany({ skipDuplicates: true })`
  // compiles to INSERT ... ON CONFLICT DO NOTHING, so a replayed renewal is a
  // zero-row insert instead of a raised unique violation.
  //
  // The distinction is load-bearing now that this runs inside a unit of work
  // (§7a): in Postgres a constraint violation aborts the WHOLE transaction, so
  // the catch-P2002-then-read pattern the rest of this module uses would fail
  // its follow-up read with "current transaction is aborted" and take the
  // caller's other writes down with it. Exception-driven idempotency is only
  // safe for a statement that autocommits alone.
  public async createIdempotent(
    data: CreatePaymentTransactionDataInterface,
    tx?: TransactionContextInterface,
  ): Promise<CreatePaymentTransactionResultInterface> {
    const client: Prisma.TransactionClient = resolvePrismaClient(this.prisma, tx);
    const inserted: { count: number } = await client.paymentTransaction.createMany({
      data: {
        userId: data.userId,
        subscriptionId: data.subscriptionId,
        status: data.status,
        amountCents: data.amountCents,
        currency: data.currency,
        provider: data.provider,
        providerRef: data.providerRef,
      },
      skipDuplicates: true,
    });
    // createMany returns a count, not the row — read it back on the same
    // client, which also covers the replay case in one branch.
    const stored: PaymentTransactionModel = await client.paymentTransaction.findUniqueOrThrow({
      where: { provider_providerRef: { provider: data.provider, providerRef: data.providerRef } },
    });

    return { transaction: this.toDomain(stored), isNew: inserted.count === 1 };
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

  // Keyset pagination, not Prisma's `cursor` + `skip: 1`: `status` is state a
  // row can leave, so a transaction settling from PENDING between two page
  // requests drops it from the filtered set — and `skip: 1`, which exists only
  // to step past the cursor row, then eats the next legitimate transaction
  // instead. Comparing ids in the `where` never depends on the cursor row
  // surviving.
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
        // `lt` pairs with `id: 'desc'` — UUIDv7 ids are time-ordered.
        ...(pagination.cursor && { id: { lt: pagination.cursor } }),
      },
      take: pagination.limit,
      orderBy: { id: 'desc' },
    });

    return transactions.map(
      (transaction: PaymentTransactionModel): PaymentTransactionInterface =>
        this.toDomain(transaction),
    );
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
