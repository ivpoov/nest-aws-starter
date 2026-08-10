/**
 * The key under which `PrismaUnitOfWorkService` hides the live
 * `Prisma.TransactionClient` on the opaque `TransactionContextInterface` it
 * hands to services.
 *
 * A `unique symbol` rather than a string key on purpose: a service holding the
 * opaque interface cannot name this property, and cannot reach it in plain JS
 * either without importing this constant from the Prisma zone — which is
 * exactly the boundary review is watching. Only
 * `resolvePrismaClient` (repositories) reads it.
 */
export const PRISMA_TRANSACTION_CLIENT: unique symbol = Symbol('PRISMA_TRANSACTION_CLIENT');
