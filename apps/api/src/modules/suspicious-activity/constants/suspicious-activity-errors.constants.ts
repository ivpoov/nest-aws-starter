import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const AUTH_TEMPORARILY_LOCKED: ErrorArgsInterface = {
  code: 'AUTH_TEMPORARILY_LOCKED',
  details: 'Too many failed login attempts — try again later',
};
