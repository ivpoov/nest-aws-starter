// PENDING rows older than this are either a missed confirm (object exists —
// reconcile to READY) or a genuine abandonment (object absent — delete).
export const FILE_SWEEP_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Caps rows processed per run so a large backlog can't push the job past its
// Redis lock TTL — the remainder is picked up on the next run.
export const FILE_SWEEP_BATCH_LIMIT = 200;

// Daily: the 24h staleness threshold makes an hourly cadence pointless
// busywork — nothing can cross the threshold between two runs less than a
// day apart anyway.
export const FILE_SWEEP_CRON_EXPRESSION = '0 3 * * *';

// Generous relative to a sweep bounded to FILE_SWEEP_BATCH_LIMIT rows — a
// crashed holder still self-heals via TTL expiry (10a).
export const FILE_SWEEP_LOCK_TTL_MS = 300_000;
