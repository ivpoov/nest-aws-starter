import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const AUTH_EMAIL_TAKEN: ErrorArgsInterface = {
  code: 'AUTH_EMAIL_TAKEN',
  details: 'An account with this email already exists',
};

export const AUTH_EMAIL_LINKED_TO_PROVIDER: ErrorArgsInterface = {
  code: 'AUTH_EMAIL_LINKED_TO_PROVIDER',
  details: 'This email belongs to an account that signs in with a linked provider',
};

export const AUTH_INVALID_CREDENTIALS: ErrorArgsInterface = {
  code: 'AUTH_INVALID_CREDENTIALS',
  details: 'Invalid email or password',
};
