import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const LAMBDA_PROVIDER_DISABLED: ErrorArgsInterface = {
  code: 'LAMBDA_PROVIDER_DISABLED',
  details: 'Lambda provider is disabled — set LAMBDA_ENABLED=true',
};

export const LAMBDA_INVOCATION_FAILED: ErrorArgsInterface = {
  code: 'LAMBDA_INVOCATION_FAILED',
  details: 'Lambda function returned an error',
};
