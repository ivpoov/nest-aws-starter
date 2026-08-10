import type { Prisma } from '@generated/prisma/client.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { PRISMA_FOREIGN_TRANSACTION_CONTEXT } from '@modules/prisma/constants/prisma-errors.constants.js';
import { PRISMA_TRANSACTION_CLIENT } from '@modules/prisma/constants/prisma-transaction.constants.js';
import type { PrismaTransactionContextInterface } from '@modules/prisma/interfaces/prisma-transaction-context.interface.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';

/**
 * The one line every transaction-aware Prisma repository starts with (§7a):
 * "run this statement on the caller's unit of work if there is one, otherwise
 * on the autocommit connection".
 *
 * A free function rather than a base class so repositories keep their flat
 * `constructor(private readonly prisma: PrismaService)` shape and inherit
 * nothing — the contract they implement stays the only thing that describes
 * them.
 */
export const resolvePrismaClient = (
  prisma: PrismaService,
  tx?: TransactionContextInterface,
): Prisma.TransactionClient => {
  if (!tx) return prisma;

  const context: Partial<PrismaTransactionContextInterface> =
    tx as Partial<PrismaTransactionContextInterface>;
  const client: Prisma.TransactionClient | undefined = context[PRISMA_TRANSACTION_CLIENT];

  // Fail loudly instead of silently autocommitting: a context from another
  // adapter's unit of work would otherwise make these writes escape the
  // transaction the caller believes it opened.
  if (!client) throw new InternalError(PRISMA_FOREIGN_TRANSACTION_CONTEXT);

  return client;
};
