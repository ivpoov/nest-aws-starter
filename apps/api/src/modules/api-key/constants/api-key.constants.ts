export const API_KEY_REPOSITORY = Symbol('API_KEY_REPOSITORY');

// Named throttler bucket for the per-key rate budget — deliberately not the
// 'default' throttler name used by the global ip-based guard, so the two
// budgets never share a counter (see ApiKeyThrottlerGuard).
export const API_KEY_THROTTLER_NAME = 'apikey';
