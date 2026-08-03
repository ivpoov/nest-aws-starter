import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const AUTH_LAST_METHOD: ErrorArgsInterface = {
  code: 'AUTH_LAST_METHOD',
  details: 'The last sign-in method cannot be removed',
};

export const AUTH_METHOD_NOT_FOUND: ErrorArgsInterface = {
  code: 'AUTH_METHOD_NOT_FOUND',
  details: 'No linked method of this type',
};
