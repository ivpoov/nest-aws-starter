import { Prisma } from '@generated/prisma/client.js';
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
