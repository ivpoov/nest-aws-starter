import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const MAIL_TRANSPORT_DISABLED: ErrorArgsInterface = {
  code: 'MAIL_TRANSPORT_DISABLED',
  details: 'Mail transport is disabled — set MAIL_ENABLED=true',
};
