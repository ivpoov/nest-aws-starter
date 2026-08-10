/**
 * Opaque handle to an in-flight unit of work (§7a).
 *
 * A service receives one from `UnitOfWorkInterface.run` and does exactly two
 * things with it: pass it to repository calls, and read `id` when logging. It
 * carries no persistence type — the concrete driver handle (a Prisma
 * transaction client, a Mongo session, ...) is attached by the persistence
 * adapter under a key this interface does not declare, so a service literally
 * cannot reach it: the property does not exist in the type it holds.
 *
 * That is what keeps "Prisma never leaves repositories" (§1) true while a
 * service still composes several writes into one atomic unit.
 */
export interface TransactionContextInterface {
  /** Correlation id for the unit of work — for logs only, never a database id. */
  readonly id: string;
}
