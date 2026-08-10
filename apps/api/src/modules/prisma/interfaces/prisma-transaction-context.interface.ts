import type { Prisma } from '@generated/prisma/client.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { PRISMA_TRANSACTION_CLIENT } from '@modules/prisma/constants/prisma-transaction.constants.js';

/**
 * The Prisma adapter's private widening of the opaque handle. Declared here and
 * used only by `PrismaUnitOfWorkService` (writes it) and `resolvePrismaClient`
 * (reads it) — both inside the Prisma zone (§6), so `Prisma.TransactionClient`
 * never appears in a service or in a repository contract.
 */
export interface PrismaTransactionContextInterface extends TransactionContextInterface {
  readonly [PRISMA_TRANSACTION_CLIENT]: Prisma.TransactionClient;
}
