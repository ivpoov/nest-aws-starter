import type { Prisma } from '@generated/prisma/client.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { PRISMA_TRANSACTION_CLIENT } from '@modules/prisma/constants/prisma-transaction.constants.js';
import { resolvePrismaClient } from '@modules/prisma/helpers/resolve-prisma-client.helper.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { PrismaUnitOfWorkService } from '@modules/prisma/services/prisma-unit-of-work.service.js';
import { describe, expect, it, vi } from 'vitest';

// Stands in for the interactive $transaction: hands the callback a marker
// client and, like the real one, lets a throw propagate (Prisma issues the
// ROLLBACK — that half is proven against Postgres in the e2e suites).
function createPrisma(): { prisma: PrismaService; client: Prisma.TransactionClient } {
  const client: Prisma.TransactionClient = {
    marker: 'tx-client',
  } as unknown as Prisma.TransactionClient;
  const prisma = {
    $transaction: vi.fn(
      <ResultType>(
        work: (tx: Prisma.TransactionClient) => Promise<ResultType>,
      ): Promise<ResultType> => work(client),
    ),
  } as unknown as PrismaService;

  return { prisma, client };
}

describe('PrismaUnitOfWorkService', () => {
  it('opens one interactive transaction and returns the callback result', async () => {
    const { prisma } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);

    const result: string = await unitOfWork.run(async (): Promise<string> => 'done');

    expect(result).toBe('done');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('hands the service an opaque context whose only readable field is a correlation id', async () => {
    const { prisma } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);

    const context: TransactionContextInterface = await unitOfWork.run(
      async (tx: TransactionContextInterface): Promise<TransactionContextInterface> => tx,
    );

    expect(typeof context.id).toBe('string');
    // The Prisma client is present but reachable only through the Prisma-zone
    // symbol — never through an enumerable, guessable property name.
    expect(Object.keys(context)).toEqual(['id']);
    expect(JSON.parse(JSON.stringify(context))).toEqual({ id: context.id });
  });

  it('joins an already-open unit instead of nesting a second transaction', async () => {
    const { prisma } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);
    const parent: TransactionContextInterface = { id: 'outer' };

    const received: TransactionContextInterface = await unitOfWork.run(
      async (tx: TransactionContextInterface): Promise<TransactionContextInterface> => tx,
      parent,
    );

    expect(received).toBe(parent);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates a throw out of the unit so the driver rolls back', async () => {
    const { prisma } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);
    const boom: Error = new Error('induced failure');

    await expect(
      unitOfWork.run(async (): Promise<never> => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});

describe('resolvePrismaClient', () => {
  it('returns the autocommit client when no context is passed', () => {
    const { prisma } = createPrisma();

    expect(resolvePrismaClient(prisma)).toBe(prisma);
  });

  it('unwraps the transaction client carried by a context from this adapter', async () => {
    const { prisma, client } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);

    const resolved: Prisma.TransactionClient = await unitOfWork.run(
      async (tx: TransactionContextInterface): Promise<Prisma.TransactionClient> =>
        resolvePrismaClient(prisma, tx),
    );

    expect(resolved).toBe(client);
  });

  it('refuses a context minted by another persistence adapter rather than silently autocommitting', () => {
    const { prisma } = createPrisma();
    const foreign: TransactionContextInterface = { id: 'not-prisma' };

    expect(() => resolvePrismaClient(prisma, foreign)).toThrow(InternalError);
  });

  it('accepts a context carrying the Prisma-zone symbol directly', () => {
    const { prisma, client } = createPrisma();
    const context: TransactionContextInterface = {
      id: 'tx-1',
      [PRISMA_TRANSACTION_CLIENT]: client,
    } as TransactionContextInterface;

    expect(resolvePrismaClient(prisma, context)).toBe(client);
  });
});
