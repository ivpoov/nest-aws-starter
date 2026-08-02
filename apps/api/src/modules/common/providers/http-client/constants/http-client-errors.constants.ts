import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const HTTP_REQUEST_FAILED: ErrorArgsInterface = {
  code: 'HTTP_REQUEST_FAILED',
  details: 'Outbound HTTP request failed',
};
