import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const AUTH_TEMPORARILY_LOCKED: ErrorArgsInterface = {
  code: 'AUTH_TEMPORARILY_LOCKED',
  details: 'Too many failed login attempts — try again later',
};

// The failed-attempt MULTI returned no usable counter. Infrastructure, not user
// input — the caller is a contained listener that logs and swallows, so a failed
// login is still recorded as failed; only the lockout accounting for that one
// attempt is lost.
export const ACCOUNT_SECURITY_LOCKOUT_COUNTER_UNAVAILABLE: ErrorArgsInterface = {
  code: 'ACCOUNT_SECURITY_LOCKOUT_COUNTER_UNAVAILABLE',
  details: 'Failed-attempt counter is unavailable',
};
