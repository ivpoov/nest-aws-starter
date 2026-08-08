// Admins have no live "unread-count" push for ADMIN-audience rows (lazily
// created receipts mean there is no single broadcastable number — see
// notification-events.constants.ts). The bell instead polls the merged
// figure at this interval; 60s balances staying reasonably fresh against
// hammering the endpoint from every open admin tab.
export const UNREAD_COUNT_POLL_INTERVAL_MS = 60_000;
