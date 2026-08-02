import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const S3_PROVIDER_DISABLED: ErrorArgsInterface = {
  code: 'S3_PROVIDER_DISABLED',
  details: 'S3 provider is disabled — set S3_ENABLED=true',
};
