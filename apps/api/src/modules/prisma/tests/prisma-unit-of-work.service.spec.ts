import type { Prisma } from '@generated/prisma/client.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { resolvePrismaClient } from '@modules/prisma/helpers/prisma-transaction-registry.helper.js';
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

// These are the encapsulation claim itself, executable. §7a says a service
// holding the handle cannot reach the database client; each spec below is one
// concrete route by which it might, and none of them may work.
describe('the transaction handle is opaque', () => {
  async function openContext(): Promise<TransactionContextInterface> {
    const { prisma } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);

    return unitOfWork.run(
      async (tx: TransactionContextInterface): Promise<TransactionContextInterface> => tx,
    );
  }

  it('exposes a correlation id and nothing else, by any reflection route', async () => {
    const context: TransactionContextInterface = await openContext();

    expect(typeof context.id).toBe('string');
    expect(Object.keys(context)).toEqual(['id']);
    // The routes a string or symbol property would NOT have survived: the client
    // hangs off the context at no key at all, exotic or otherwise.
    expect(Object.getOwnPropertySymbols(context)).toEqual([]);
    expect(Reflect.ownKeys(context)).toEqual(['id']);
    expect(Object.values(context)).toEqual([context.id]);
    expect(JSON.parse(JSON.stringify(context))).toEqual({ id: context.id });
  });

  it('is frozen, so nothing can be smuggled onto it later', async () => {
    const context: TransactionContextInterface = await openContext();

    expect(Object.isFrozen(context)).toBe(true);
  });

  // The leak that would actually happen in practice: a context spread into a log
  // line, an event payload or a DTO. The copy must carry no client, and must be
  // rejected rather than silently autocommitting the caller's writes.
  it('carries no client through a spread or Object.assign copy', async () => {
    const { prisma } = createPrisma();
    const context: TransactionContextInterface = await openContext();

    const spread: TransactionContextInterface = { ...context };
    const assigned: TransactionContextInterface = Object.assign({}, context);

    expect(Object.getOwnPropertySymbols(spread)).toEqual([]);
    expect(Reflect.ownKeys(spread)).toEqual(['id']);
    expect(() => resolvePrismaClient(prisma, spread)).toThrow(InternalError);
    expect(() => resolvePrismaClient(prisma, assigned)).toThrow(InternalError);
  });
});

describe('resolvePrismaClient', () => {
  it('returns the autocommit client when no context is passed', () => {
    const { prisma } = createPrisma();

    expect(resolvePrismaClient(prisma)).toBe(prisma);
  });

  it('unwraps the transaction client for the context that opened the unit', async () => {
    const { prisma, client } = createPrisma();
    const unitOfWork: PrismaUnitOfWorkService = new PrismaUnitOfWorkService(prisma);

    const resolved: Prisma.TransactionClient = await unitOfWork.run(
      async (tx: TransactionContextInterface): Promise<Prisma.TransactionClient> =>
        resolvePrismaClient(prisma, tx),
    );

    expect(resolved).toBe(client);
  });

  it('refuses a hand-forged context rather than silently autocommitting', () => {
    const { prisma } = createPrisma();
    const forged: TransactionContextInterface = { id: 'not-a-real-unit' };

    expect(() => resolvePrismaClient(prisma, forged)).toThrow(InternalError);
  });
});
