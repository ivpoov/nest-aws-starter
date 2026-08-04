import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const CLOUDFRONT_SIGNER_DISABLED: ErrorArgsInterface = {
  code: 'CLOUDFRONT_SIGNER_DISABLED',
  details: 'CloudFront signer is disabled — set CLOUDFRONT_ENABLED=true',
};
