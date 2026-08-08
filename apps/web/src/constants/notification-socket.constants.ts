// Caps the live-arrived feed the socket hook keeps in memory — it is a
// recency buffer, not a substitute for the paginated REST list.
export const MAX_LIVE_NOTIFICATIONS = 20;

// Bounds the hook's own manual reconnect (triggered on an `io server
// disconnect`, e.g. the gateway's heartbeat sweep rejecting a stale token)
// so a genuinely dead session retries a handful of times, logs, and stops —
// it never spins forever against a server that keeps rejecting it.
export const MAX_MANUAL_RECONNECT_ATTEMPTS = 3;

// First manual reconnect waits this long; every further attempt doubles it
// (1s → 2s → 4s). The gateway rejects *after* the transport-level connect
// completes, so an immediate retry would hammer it once per round trip.
export const MANUAL_RECONNECT_BASE_DELAY_MS = 1_000;

// A connection only earns the manual-reconnect budget back after surviving
// this long. The client-side `connect` event alone proves nothing — the
// gateway always writes CONNECT before handleConnection can reject the
// handshake, so resetting on `connect` would make the bound unreachable.
export const STABLE_CONNECTION_RESET_MS = 10_000;
