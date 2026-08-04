import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const CASL_FORBIDDEN: ErrorArgsInterface = {
  code: 'CASL_FORBIDDEN',
  details: 'Insufficient permissions for this action',
};

export const ADMIN_IMPERSONATION_FORBIDDEN: ErrorArgsInterface = {
  code: 'ADMIN_IMPERSONATION_FORBIDDEN',
  details: 'Admin routes are unavailable while impersonating a user',
};
