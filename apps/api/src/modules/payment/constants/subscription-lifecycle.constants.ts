// Grace window after currentPeriodEndsAt before the hourly expiry job
// transitions an overdue ACTIVE/PAST_DUE subscription to EXPIRED — gives a
// slow/retried payment or a lagging provider webhook a window to still land
// as a renewal before access is cut off.
export const EXPIRY_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

// Caps rows processed per run so a backlog — a provider outage, or the job
// simply not having run for a while — cannot load an unbounded result set
// into memory or push the sweep past its Redis lock TTL. Expiring a row takes
// it out of the overdue set, so the remainder is picked up on the next hourly
// run; the oldest are always handled first. Same shape as
// FILE_SWEEP_BATCH_LIMIT.
export const EXPIRY_SWEEP_BATCH_LIMIT = 200;
