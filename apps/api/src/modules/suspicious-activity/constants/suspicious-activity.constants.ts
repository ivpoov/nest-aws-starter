export const LOCKOUT_REPOSITORY = Symbol('LOCKOUT_REPOSITORY');

// Verbatim-binding thresholds from the task brief — not env-configurable.
export const FAILED_LOGIN_THRESHOLD = 5;
export const FAILED_LOGIN_WINDOW_SEC = 900;
export const LOCKOUT_TTL_SEC = 900;
