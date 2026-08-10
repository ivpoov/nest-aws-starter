export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

// Rows per batch when read-all backfills an admin's missing ADMIN-audience
// receipts. Caps how much a single mark-all-read pulls into memory and how
// large one createMany gets; the loop repeats until the backlog is drained,
// so the user-visible outcome is unchanged.
export const NOTIFICATION_RECEIPT_BACKFILL_BATCH_SIZE = 500;
