// Default lock TTL when a job doesn't declare its own `lockTtlMs` — a rough
// "2x expected runtime" guess for a job with no stated expectation.
export const DEFAULT_LOCK_TTL_MS = 60_000;
