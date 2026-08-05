import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

// Single generic code for every handshake/heartbeat auth failure (missing
// token, bad signature, expired, revoked from the allowlist, ...) — the
// client is deliberately never told which one, only that the socket is
// unauthorized; the specific reason is logged server-side at debug.
export const NOTIFICATION_WS_AUTH_FAILED: ErrorArgsInterface = {
  code: 'NOTIFICATION_WS_AUTH_FAILED',
  details: 'WebSocket authentication failed',
};

export const NOTIFICATION_NOT_FOUND: ErrorArgsInterface = {
  code: 'NOTIFICATION_NOT_FOUND',
  details: 'Notification not found',
};

export const NOTIFICATION_ACCESS_DENIED: ErrorArgsInterface = {
  code: 'NOTIFICATION_ACCESS_DENIED',
  details: 'This notification is not visible to you',
};
