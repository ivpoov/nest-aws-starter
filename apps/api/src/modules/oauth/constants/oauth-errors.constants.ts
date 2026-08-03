import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const OAUTH_PROVIDER_NOT_ENABLED: ErrorArgsInterface = {
  code: 'OAUTH_PROVIDER_NOT_ENABLED',
  details: 'This sign-in provider is not enabled',
};

export const OAUTH_STATE_INVALID: ErrorArgsInterface = {
  code: 'OAUTH_STATE_INVALID',
  details: 'The sign-in attempt is invalid or has expired — start again',
};

export const OAUTH_EXCHANGE_CODE_INVALID: ErrorArgsInterface = {
  code: 'OAUTH_EXCHANGE_CODE_INVALID',
  details: 'The sign-in code is invalid, expired or already used',
};

export const OAUTH_REDIRECT_NOT_ALLOWED: ErrorArgsInterface = {
  code: 'OAUTH_REDIRECT_NOT_ALLOWED',
  details: 'The redirect target is not allowed',
};

export const AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT: ErrorArgsInterface = {
  code: 'AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT',
  details: 'This email already belongs to another account',
};

export const AUTH_METHOD_LINKED_ELSEWHERE: ErrorArgsInterface = {
  code: 'AUTH_METHOD_LINKED_ELSEWHERE',
  details: 'This provider account is already linked to another user',
};

export const AUTH_METHOD_ALREADY_LINKED: ErrorArgsInterface = {
  code: 'AUTH_METHOD_ALREADY_LINKED',
  details: 'An account of this provider type is already linked',
};
