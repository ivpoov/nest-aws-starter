import { randomUUID } from 'node:crypto';
import type { Prisma } from '@generated/prisma/client.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import type { UnitOfWorkInterface } from '@interfaces/unit-of-work.interface.js';
import { PRISMA_TRANSACTION_CLIENT } from '@modules/prisma/constants/prisma-transaction.constants.js';
import type { PrismaTransactionContextInterface } from '@modules/prisma/interfaces/prisma-transaction-context.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

/**
 * The Prisma implementation of the service-side transaction boundary (§7a).
 *
 * Prisma's interactive `$transaction` is what makes rollback real: the callback
 * runs on a single dedicated connection inside `BEGIN`/`COMMIT`, and any throw
 * escaping it issues `ROLLBACK` and re-throws. This class only wraps that in the
 * opaque handle so nothing Prisma-shaped crosses into a service.
 */
@Injectable()
export class PrismaUnitOfWorkService implements UnitOfWorkInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async run<ResultType>(
    work: (tx: TransactionContextInterface) => Promise<ResultType>,
    parent?: TransactionContextInterface,
  ): Promise<ResultType> {
    // Join semantics: an inner `run` reuses the caller's open unit instead of
    // opening a second, independent transaction on another connection — which
    // could not see the outer one's uncommitted rows and can deadlock with it.
    if (parent) return work(parent);

    return this.prisma.$transaction(
      async (client: Prisma.TransactionClient): Promise<ResultType> => {
        const context: PrismaTransactionContextInterface = {
          id: randomUUID(),
          [PRISMA_TRANSACTION_CLIENT]: client,
        };

        return work(context);
      },
    );
  }
}
