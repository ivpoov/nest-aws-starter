import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const SNS_PROVIDER_DISABLED: ErrorArgsInterface = {
  code: 'SNS_PROVIDER_DISABLED',
  details: 'SNS provider is disabled — set SNS_ENABLED=true',
};
