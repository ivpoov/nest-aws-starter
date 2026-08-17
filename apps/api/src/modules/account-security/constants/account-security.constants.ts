export const LOCKOUT_REPOSITORY = Symbol('LOCKOUT_REPOSITORY');

// Fixed thresholds, deliberately not env-configurable: a deployment that can
// widen its own lockout window has no lockout policy.
export const FAILED_LOGIN_THRESHOLD = 5;
export const FAILED_LOGIN_WINDOW_SEC = 900;
export const LOCKOUT_TTL_SEC = 900;
