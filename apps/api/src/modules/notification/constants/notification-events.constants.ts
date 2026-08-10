// Wire contract for this gateway's socket events — the only two event names
// it ever emits (no RPC: clients never emit anything the server listens
// to; an unauthorized/revoked socket is just disconnected, nothing is
// emitted to it — see NotificationGateway.rejectHandshake).
//
// Reserved here, in the module that owns the transport, so the
// event subscriber sends `NOTIFICATION_EVENT` (payload =
// `NotificationResponseInterface`) and `UNREAD_COUNT_EVENT` (payload =
// `number`) without redefining the names itself.
export const NOTIFICATION_EVENT = 'notification';
export const UNREAD_COUNT_EVENT = 'unread-count';
