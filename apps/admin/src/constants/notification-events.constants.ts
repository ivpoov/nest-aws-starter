// Mirrors apps/api/src/modules/notification/constants/notification-events.constants.ts
// literal-for-literal — the gateway's wire contract, not re-exported from
// shared because it is transport metadata, not a request/response shape.
export const NOTIFICATION_EVENT = 'notification';

// Emitted by the gateway too, but deliberately not wired up in
// useNotificationSocket: the event subscriber only computes this figure for a
// USER-audience row (`countUnread({ includeAdmin: false })`, see
// notification-event-subscriber.service.ts) — for an admin it would understate
// the merged USER+ADMIN badge whenever an unread ADMIN-audience row exists.
// The admin bell instead polls GET /notifications/unread-count (see
// notification-unread-count-poll.constants.ts). Kept here for parity with
// the wire contract and so a future admin-merged push has an obvious event
// name to reuse.
export const UNREAD_COUNT_EVENT = 'unread-count';
