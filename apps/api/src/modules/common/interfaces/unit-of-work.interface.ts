import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';

/**
 * The service-side transaction boundary (§7a). Injected by the `UNIT_OF_WORK`
 * token; implemented by the persistence adapter (`PrismaUnitOfWorkService`),
 * never by a feature module.
 *
 * `run` opens one unit of work, hands the service an opaque
 * `TransactionContextInterface`, and commits when `work` resolves. Any throw
 * — from a repository, from a business rule, from an induced fault — rolls the
 * whole unit back and re-throws, so a partially applied multi-write state is
 * not reachable.
 */
export interface UnitOfWorkInterface {
  /**
   * @param work   Receives the context to thread into repository calls. Do only
   *               database work here: events, mail, cache writes and other
   *               non-transactional side effects belong AFTER `run` resolves,
   *               because a rollback cannot take them back.
   * @param parent An already-open unit of work to JOIN instead of nesting. A
   *               nested `run` without it would open a second, independent
   *               transaction on another connection — which cannot see this
   *               one's uncommitted rows and can deadlock against it. Pass the
   *               `tx` a method received and the writes land in the caller's
   *               unit; omit it and a fresh one is opened.
   */
  run<ResultType>(
    work: (tx: TransactionContextInterface) => Promise<ResultType>,
    parent?: TransactionContextInterface,
  ): Promise<ResultType>;
}
