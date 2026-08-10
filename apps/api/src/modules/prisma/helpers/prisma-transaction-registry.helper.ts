import { randomUUID } from 'node:crypto';
import type { Prisma } from '@generated/prisma/client.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { PRISMA_FOREIGN_TRANSACTION_CONTEXT } from '@modules/prisma/constants/prisma-errors.constants.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';

/**
 * The context -> client mapping, private to this module. A `WeakMap` and not a
 * property on the context itself: a property is reachable through
 * `Object.getOwnPropertySymbols` / `Reflect.ownKeys` however exotic its key, and
 * an enumerable one is *copied* by `{...tx}` and `Object.assign` — so spreading
 * a context into a log line, an event payload or a DTO would carry a live
 * transaction client out of the Prisma zone with it.
 *
 * Keyed on the context object's identity, the client hangs off nothing. The
 * handed-out context is a frozen `{ id }` and stays that way; the only way to
 * reach a client is to be this file. Entries die with the context, so a unit of
 * work cannot leak memory either.
 */
const clientsByContext: WeakMap<TransactionContextInterface, Prisma.TransactionClient> =
  new WeakMap();

/**
 * Mints the opaque handle for one unit of work and registers its client.
 * Called only by `PrismaUnitOfWorkService`.
 */
export const openPrismaTransactionContext = (
  client: Prisma.TransactionClient,
): TransactionContextInterface => {
  const context: TransactionContextInterface = Object.freeze({ id: randomUUID() });

  clientsByContext.set(context, client);

  return context;
};

/**
 * The one line every transaction-aware Prisma repository starts with (§7a):
 * "run this statement on the caller's unit of work if there is one, otherwise on
 * the autocommit connection".
 *
 * A free function rather than a base class so repositories keep their flat
 * `constructor(private readonly prisma: PrismaService)` shape and inherit
 * nothing — the contract they implement stays the only thing that describes them.
 */
export const resolvePrismaClient = (
  prisma: PrismaService,
  tx?: TransactionContextInterface,
): Prisma.TransactionClient => {
  if (!tx) return prisma;

  const client: Prisma.TransactionClient | undefined = clientsByContext.get(tx);

  // Fail loudly instead of silently autocommitting. This catches all three ways
  // a caller can hold something that is not a live unit of work: a context from
  // another persistence adapter, a hand-forged object, and — the one that
  // actually happens — a `{...tx}` copy, which is a different identity and so is
  // not in the map.
  if (!client) throw new InternalError(PRISMA_FOREIGN_TRANSACTION_CONTEXT);

  return client;
};
