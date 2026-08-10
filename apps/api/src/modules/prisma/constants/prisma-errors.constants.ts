import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

/**
 * A `TransactionContextInterface` reached a Prisma repository without carrying a
 * Prisma transaction client — i.e. it was minted by a different persistence
 * adapter's unit of work. A wiring bug, never a user input, so it surfaces as an
 * INTERNAL error and is never expected in a passing test.
 */
export const PRISMA_FOREIGN_TRANSACTION_CONTEXT: ErrorArgsInterface = {
  code: 'PRISMA_FOREIGN_TRANSACTION_CONTEXT',
  details: 'Transaction context was not created by the Prisma unit of work',
};
