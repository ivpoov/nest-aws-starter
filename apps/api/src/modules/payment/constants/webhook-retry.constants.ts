// FAILED events older than this AND stale RECEIVED events older than this are
// both retry-sweep candidates — one threshold serves both halves of the job.
export const WEBHOOK_RETRY_STALE_MS = 60 * 60 * 1000;

// Ceiling on total attempts across the initial dispatch loop
// (MAX_WEBHOOK_ATTEMPTS = 5) plus however many retry-job passes re-queue the
// event. Once attempts reaches this, the retry job stops picking the row
// back up — it stays FAILED for good.
export const WEBHOOK_RETRY_MAX_ATTEMPTS = 8;

// Caps rows processed per run so a large backlog can't push the job past its
// Redis lock TTL — the remainder is picked up on the next run.
export const WEBHOOK_RETRY_BATCH_LIMIT = 200;

export const WEBHOOK_RETRY_CRON_EXPRESSION = '0 * * * *';

// Generous relative to a sweep over an expected-small retryable set — a
// crashed holder still self-heals via TTL expiry (10a).
export const WEBHOOK_RETRY_LOCK_TTL_MS = 300_000;
