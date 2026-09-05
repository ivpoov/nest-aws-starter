// Nightly, at an hour chosen to sit away from the other sweeps rather than on
// top of them: retention is measured in days, so an hourly run would be
// busywork that deletes nothing on most passes.
export const RETENTION_CRON_EXPRESSION = '0 4 * * *';

// ~2x the expected runtime, per the ScheduledJobInterface guidance. Batched
// deletes on a table with a year of rows are the slow case this covers, and a
// crashed lock-holder self-heals once the TTL expires.
export const RETENTION_LOCK_TTL_MS = 900_000;
