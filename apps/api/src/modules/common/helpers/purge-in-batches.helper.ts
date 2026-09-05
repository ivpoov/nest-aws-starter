import type { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';

// The loop every retention job runs, in one place because getting it wrong is
// not obvious from reading any single copy of it.
//
// Two properties matter. It stops when a pass deletes fewer rows than it asked
// for, which is how it knows the tail is reached without counting first. And it
// stops unconditionally at `maxBatches`, so a delete that silently affects
// nothing — a predicate that no longer matches, a permission problem — cannot
// spin forever inside a scheduled job holding a Redis lock.
const MAX_BATCHES = 1_000;

export async function purgeInBatches(
  label: string,
  batchSize: number,
  logger: CustomLoggerService,
  deleteBatch: (limit: number) => Promise<number>,
): Promise<number> {
  let total = 0;

  for (let pass = 0; pass < MAX_BATCHES; pass += 1) {
    const deleted: number = await deleteBatch(batchSize);

    total += deleted;

    if (deleted < batchSize) {
      if (total > 0) logger.log(`Retention: removed ${total} ${label} row(s)`);

      return total;
    }
  }

  // Reaching this means MAX_BATCHES * batchSize rows went in one run. Said out
  // loud rather than silently truncated: the next run continues where this one
  // stopped, and a backlog that never clears is worth knowing about.
  logger.warn(
    `Retention: stopped after ${MAX_BATCHES} batches of ${label} (${total} row(s)); more remain`,
  );

  return total;
}
