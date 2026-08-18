export const NOTIFICATION_ERROR_CODES = [
  'NOTIFICATION_NOT_FOUND',
  'NOTIFICATION_ACCESS_DENIED',
  'NOTIFICATION_PREFERENCE_TYPE_INVALID',
  'NOTIFICATION_PREFERENCE_CHANNEL_IMMUTABLE',
  // Delivered over the socket handshake rather than an HTTP response, but a
  // client branches on it exactly the same way, so it belongs on the contract.
  'NOTIFICATION_WS_AUTH_FAILED',
] as const;
