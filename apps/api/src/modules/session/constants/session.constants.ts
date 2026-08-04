export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

// Admin login-as sessions stay alive for a single hour, refreshed or not —
// deliberately far shorter than the normal refresh TTL.
export const IMPERSONATION_ACTIVE_TTL_SEC = 3_600;
