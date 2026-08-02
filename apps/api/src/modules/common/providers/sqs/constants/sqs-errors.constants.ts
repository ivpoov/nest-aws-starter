import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const SQS_PROVIDER_DISABLED: ErrorArgsInterface = {
  code: 'SQS_PROVIDER_DISABLED',
  details: 'SQS provider is disabled — set SQS_ENABLED=true',
};
