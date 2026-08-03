import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const AUTH_TOKEN_INVALID: ErrorArgsInterface = {
  code: 'AUTH_TOKEN_INVALID',
  details: 'Access token is missing, invalid or revoked',
};
