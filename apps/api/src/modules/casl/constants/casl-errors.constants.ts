import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const CASL_FORBIDDEN: ErrorArgsInterface = {
  code: 'CASL_FORBIDDEN',
  details: 'Insufficient permissions for this action',
};
