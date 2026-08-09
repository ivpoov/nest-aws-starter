import { Prisma } from '@generated/prisma/client.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import { PaymentTransactionPrismaRepository } from '@modules/payment/repositories/payment-transaction-prisma.repository.js';
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
    create: vi.fn().mockResolvedValue(row),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    findMany: vi.fn().mockResolvedValue([row]),
    ...overrides,
  };
  const prisma = { paymentTransaction } as unknown as PrismaService;
  const repository = new PaymentTransactionPrismaRepository(prisma);

  return { repository, paymentTransaction };
}

describe('PaymentTransactionPrismaRepository.createIdempotent', () => {
  it('creates a new row and reports isNew=true', async () => {
    const { repository, paymentTransaction } = createRepository();

    const result = await repository.createIdempotent(data);

    expect(paymentTransaction.create).toHaveBeenCalledWith({ data });
    expect(result.isNew).toBe(true);
    expect(result.transaction.id).toBe('txn-1');
  });

  it('falls back to the existing row on a duplicate (P2002) and reports isNew=false', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
    });
    const { repository, paymentTransaction } = createRepository({
      create: vi.fn().mockRejectedValue(duplicate),
    });

    const result = await repository.createIdempotent(data);

    expect(paymentTransaction.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { provider_providerRef: { provider: 'STRIPE', providerRef: 'in_1' } },
    });
    expect(result.isNew).toBe(false);
  });

  it('rethrows any other Prisma error unchanged', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ create: vi.fn().mockRejectedValue(other) });

    await expect(repository.createIdempotent(data)).rejects.toBe(other);
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
