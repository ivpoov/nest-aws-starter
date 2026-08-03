import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const AUTH_REFRESH_INVALID: ErrorArgsInterface = {
  code: 'AUTH_REFRESH_INVALID',
  details: 'Refresh token is invalid or revoked',
};

export const AUTH_SESSION_EXPIRED: ErrorArgsInterface = {
  code: 'AUTH_SESSION_EXPIRED',
  details: 'Session has expired — log in again',
};

export const SESSION_NOT_FOUND: ErrorArgsInterface = {
  code: 'SESSION_NOT_FOUND',
  details: 'Session not found',
};
