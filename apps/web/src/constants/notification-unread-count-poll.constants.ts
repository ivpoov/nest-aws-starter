// The gateway's `unread-count` push is deliberately ignored (see
// notification-events.constants.ts) and the socket itself can be down
// entirely — a proxy blocking websockets, WEBSOCKET_ENABLED=false, or an
// exhausted reconnect budget. The bell instead polls the authoritative
// figure at this interval; 60s balances staying reasonably fresh against
// hammering the endpoint from every open tab.
export const UNREAD_COUNT_POLL_INTERVAL_MS = 60_000;
