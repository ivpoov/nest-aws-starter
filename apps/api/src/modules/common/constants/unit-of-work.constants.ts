/**
 * Injection token for `UnitOfWorkInterface` (§7a). The contract lives in
 * `common` because services depend on it; the implementation lives in the
 * persistence adapter (`PrismaModule` binds `PrismaUnitOfWorkService`), so
 * swapping the store swaps one binding and no service file.
 */
export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
