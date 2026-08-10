import { Prisma } from '@generated/prisma/client.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import { PaymentTransactionPrismaRepository } from '@modules/payment/repositories/payment-transaction-prisma.repository.js';
import { PRISMA_TRANSACTION_CLIENT } from '@modules/prisma/constants/prisma-transaction.constants.js';
import type { PrismaTransactionContextInterface } from '@modules/prisma/interfaces/prisma-transaction-context.interface.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const row = {
  id: 'txn-1',
  userId: 'user-1',
  subscriptionId: 'sub-row-1',
  status: 'SUCCEEDED',
  amountCents: 1900,
  currency: 'USD',
  provider: 'STRIPE',
  providerRef: 'in_1',
  createdAt: new Date('2026-08-04T00:00:00Z'),
};

const data = {
  userId: 'user-1',
  subscriptionId: 'sub-row-1',
  status: TransactionStatusEnum.SUCCEEDED,
  amountCents: 1900,
  currency: 'USD',
  provider: 'STRIPE',
  providerRef: 'in_1',
};

function createRepository(overrides: Record<string, ReturnType<typeof vi.fn>> = {}): {
  repository: PaymentTransactionPrismaRepository;
  paymentTransaction: Record<string, ReturnType<typeof vi.fn>>;
} {
  const paymentTransaction = {
    createMany: vi.fn().mockResolvedValue({ count: 1 }),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    findMany: vi.fn().mockResolvedValue([row]),
    ...overrides,
  };
  const prisma = { paymentTransaction } as unknown as PrismaService;
  const repository = new PaymentTransactionPrismaRepository(prisma);

  return { repository, paymentTransaction };
}

describe('PaymentTransactionPrismaRepository.createIdempotent', () => {
  it('inserts with skipDuplicates, reads the row back, and reports isNew=true', async () => {
    const { repository, paymentTransaction } = createRepository();

    const result = await repository.createIdempotent(data);

    expect(paymentTransaction.createMany).toHaveBeenCalledWith({ data, skipDuplicates: true });
    expect(paymentTransaction.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { provider_providerRef: { provider: 'STRIPE', providerRef: 'in_1' } },
    });
    expect(result.isNew).toBe(true);
    expect(result.transaction.id).toBe('txn-1');
  });

  // The replay path is a zero-row insert, NOT a raised P2002: inside a unit of
  // work a raised unique violation would abort the whole transaction and take
  // the caller's other writes with it.
  it('reports isNew=false and returns the stored row when the insert is skipped as a duplicate', async () => {
    const { repository, paymentTransaction } = createRepository({
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    });

    const result = await repository.createIdempotent(data);

    expect(paymentTransaction.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { provider_providerRef: { provider: 'STRIPE', providerRef: 'in_1' } },
    });
    expect(result.isNew).toBe(false);
    expect(result.transaction.id).toBe('txn-1');
  });

  it('rethrows any other Prisma error unchanged', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ createMany: vi.fn().mockRejectedValue(other) });

    await expect(repository.createIdempotent(data)).rejects.toBe(other);
  });

  // The whole point of the optional handle: when one is passed, every statement
  // must run on the caller's transaction client, never on the autocommit one.
  it('routes both statements through the transaction client when a context is given', async () => {
    const { repository, paymentTransaction } = createRepository();
    const transactionalPaymentTransaction = {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    };
    const context: PrismaTransactionContextInterface = {
      id: 'tx-1',
      [PRISMA_TRANSACTION_CLIENT]: {
        paymentTransaction: transactionalPaymentTransaction,
      } as unknown as Prisma.TransactionClient,
    };

    const result = await repository.createIdempotent(data, context as TransactionContextInterface);

    expect(transactionalPaymentTransaction.createMany).toHaveBeenCalledTimes(1);
    expect(transactionalPaymentTransaction.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(paymentTransaction.createMany).not.toHaveBeenCalled();
    expect(paymentTransaction.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(result.isNew).toBe(true);
  });
});

describe('PaymentTransactionPrismaRepository.findManyByUserAfter', () => {
  it('scopes by userId, applies the cursor, and orders by id desc', async () => {
    const { repository, paymentTransaction } = createRepository();
    const pagination: CursorPaginationInterface = { cursor: 'txn-0', limit: 20 };

    const result = await repository.findManyByUserAfter('user-1', pagination);

    expect(paymentTransaction.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      take: 20,
      cursor: { id: 'txn-0' },
      skip: 1,
      orderBy: { id: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('txn-1');
  });

  it('omits the cursor clause on the first page', async () => {
    const { repository, paymentTransaction } = createRepository();
    const pagination: CursorPaginationInterface = { cursor: null, limit: 20 };

    await repository.findManyByUserAfter('user-1', pagination);

    expect(paymentTransaction.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      take: 20,
      orderBy: { id: 'desc' },
    });
  });
});

describe('PaymentTransactionPrismaRepository.findManyForAdmin', () => {
  it('applies userId, status, and date-range filters together', async () => {
    const { repository, paymentTransaction } = createRepository();
    const pagination: CursorPaginationInterface = { cursor: null, limit: 20 };
    const filters: TransactionFiltersInterface = {
      userId: 'user-1',
      status: TransactionStatusEnum.SUCCEEDED,
      dateFrom: new Date('2026-08-01T00:00:00Z'),
      dateTo: new Date('2026-08-03T23:59:59Z'),
    };

    await repository.findManyForAdmin(pagination, filters);

    expect(paymentTransaction.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'SUCCEEDED',
        createdAt: { gte: filters.dateFrom, lte: filters.dateTo },
      },
      take: 20,
      orderBy: { id: 'desc' },
    });
  });

  it('keysets the cursor into the where clause instead of offsetting past it', async () => {
    const { repository, paymentTransaction } = createRepository();
    const pagination: CursorPaginationInterface = { cursor: 'txn-0', limit: 20 };
    const filters: TransactionFiltersInterface = { status: TransactionStatusEnum.SUCCEEDED };

    await repository.findManyForAdmin(pagination, filters);

    expect(paymentTransaction.findMany).toHaveBeenCalledWith({
      where: { status: 'SUCCEEDED', id: { lt: 'txn-0' } },
      take: 20,
      orderBy: { id: 'desc' },
    });
  });

  it('builds an unfiltered where clause when no filters are given', async () => {
    const { repository, paymentTransaction } = createRepository();
    const pagination: CursorPaginationInterface = { cursor: null, limit: 20 };
    const filters: TransactionFiltersInterface = {};

    await repository.findManyForAdmin(pagination, filters);

    expect(paymentTransaction.findMany).toHaveBeenCalledWith({
      where: {},
      take: 20,
      orderBy: { id: 'desc' },
    });
  });
});
