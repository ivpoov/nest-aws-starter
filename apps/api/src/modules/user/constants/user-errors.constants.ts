import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const USER_NOT_FOUND: ErrorArgsInterface = {
  code: 'USER_NOT_FOUND',
  details: 'User not found',
};

export const USER_BLOCKED: ErrorArgsInterface = {
  code: 'USER_BLOCKED',
  details: 'This account is blocked',
};
