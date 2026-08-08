// Mirrors apps/api/src/modules/notification/constants/notification-events.constants.ts
// literal-for-literal — the gateway's wire contract, not re-exported from
// shared because it is transport metadata, not a request/response shape.
export const NOTIFICATION_EVENT = 'notification';

// Emitted by the gateway too, but deliberately not wired up in
// useNotificationSocket: the dispatcher computes this figure for a
// USER-audience row only (`countUnread({ includeAdmin: false })`, see
// notification-dispatcher.service.ts) while GET /notifications/unread-count
// merges ADMIN-audience rows for an ADMIN-role user — so for an admin using
// this app the push would overwrite the merged badge with the smaller
// USER-only figure. The bell instead polls the REST endpoint (see
// notification-unread-count-poll.constants.ts). Kept here for parity with
// the wire contract and so a future merged push has an obvious event name
// to reuse.
export const UNREAD_COUNT_EVENT = 'unread-count';
