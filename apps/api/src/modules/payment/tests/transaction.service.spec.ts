import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { PaymentTransactionInterface } from '@modules/payment/interfaces/payment-transaction.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import type { TransactionFiltersInterface } from '@modules/payment/interfaces/transaction-filters.interface.js';
import { TransactionService } from '@modules/payment/services/transaction.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const transaction: PaymentTransactionInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  userId: '01890a5d-0000-774b-bcce-b30209990001',
  subscriptionId: null,
  status: TransactionStatusEnum.SUCCEEDED,
  amountCents: 1900,
  currency: 'USD',
  provider: 'STRIPE',
  providerRef: 'in_1',
  createdAt: new Date('2026-08-04T00:00:00Z'),
};

interface TestSetupInterface {
  readonly service: TransactionService;
  readonly repository: PaymentTransactionRepositoryInterface;
}

function createService(
  overrides: Partial<PaymentTransactionRepositoryInterface> = {},
): TestSetupInterface {
  const repository: PaymentTransactionRepositoryInterface = {
    createIdempotent: vi.fn(),
    findManyByUserAfter: vi.fn().mockResolvedValue([transaction]),
    findManyForAdmin: vi.fn().mockResolvedValue([transaction]),
    ...overrides,
  };
  const service: TransactionService = new TransactionService(repository);

  return { service, repository };
}

describe('TransactionService.findManyForUser', () => {
  it('scopes the list by userId and pages by cursor', async () => {
    const secondTransaction: PaymentTransactionInterface = {
      ...transaction,
      id: '01890a5d-ac96-774b-bcce-b302099a9999',
    };
    const findManyByUserAfter = vi.fn().mockResolvedValue([transaction, secondTransaction]);
    const { service } = createService({ findManyByUserAfter });

    const pagination: CursorPaginationInterface = { cursor: null, limit: 2 };
    const page = await service.findManyForUser(transaction.userId, pagination);

    expect(findManyByUserAfter).toHaveBeenCalledWith(transaction.userId, pagination);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe(secondTransaction.id);
  });

  it('returns a null nextCursor when the page is short of the limit', async () => {
    const { service } = createService({
      findManyByUserAfter: vi.fn().mockResolvedValue([transaction]),
    });

    const page = await service.findManyForUser(transaction.userId, { cursor: null, limit: 2 });

    expect(page.nextCursor).toBeNull();
  });
});

describe('TransactionService.findManyForAdmin', () => {
  it('passes pagination and filters through to the repository', async () => {
    const findManyForAdmin = vi.fn().mockResolvedValue([transaction]);
    const { service } = createService({ findManyForAdmin });

    const pagination: CursorPaginationInterface = { cursor: null, limit: 20 };
    const filters: TransactionFiltersInterface = {
      userId: transaction.userId,
      status: TransactionStatusEnum.SUCCEEDED,
    };

    const page = await service.findManyForAdmin(pagination, filters);

    expect(findManyForAdmin).toHaveBeenCalledWith(pagination, filters);
    expect(page.items).toEqual([transaction]);
    expect(page.nextCursor).toBeNull();
  });
});
