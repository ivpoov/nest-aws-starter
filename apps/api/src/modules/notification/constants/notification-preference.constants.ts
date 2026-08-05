export const NOTIFICATION_PREFERENCE_REPOSITORY = Symbol('NOTIFICATION_PREFERENCE_REPOSITORY');

// The dispatcher's EMAIL gate consults a cached read of stored preferences;
// a write invalidates the same key immediately, so 60s is a worst-case
// staleness bound for readers who never write, not a real one for writers.
export const NOTIFICATION_PREFERENCE_CACHE_TTL_MS = 60_000;
