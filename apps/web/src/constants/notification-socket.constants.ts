// Caps the live-arrived feed the socket hook keeps in memory — it is a
// recency buffer, not a substitute for the paginated REST list.
export const MAX_LIVE_NOTIFICATIONS = 20;

// Bounds the hook's own manual reconnect (triggered on an `io server
// disconnect`, e.g. the gateway's heartbeat sweep rejecting a stale token)
// so a genuinely dead session retries a handful of times, logs, and stops —
// it never spins forever against a server that keeps rejecting it.
export const MAX_MANUAL_RECONNECT_ATTEMPTS = 3;
