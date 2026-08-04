import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const API_KEY_INVALID: ErrorArgsInterface = {
  code: 'API_KEY_INVALID',
  details: 'API key is missing, unknown, or revoked',
};

export const API_KEY_NOT_FOUND: ErrorArgsInterface = {
  code: 'API_KEY_NOT_FOUND',
  details: 'API key not found',
};
