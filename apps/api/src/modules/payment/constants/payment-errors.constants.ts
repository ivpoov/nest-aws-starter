import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const PLAN_NOT_FOUND: ErrorArgsInterface = {
  code: 'PLAN_NOT_FOUND',
  details: 'This plan does not exist or is no longer available',
};

export const PAYMENT_PROVIDER_NOT_ENABLED: ErrorArgsInterface = {
  code: 'PAYMENT_PROVIDER_NOT_ENABLED',
  details: 'No payment provider is enabled',
};

export const PAYMENT_NO_SUBSCRIPTION: ErrorArgsInterface = {
  code: 'PAYMENT_NO_SUBSCRIPTION',
  details: 'You do not have an active subscription',
};

export const PAYMENT_PORTAL_UNAVAILABLE: ErrorArgsInterface = {
  code: 'PAYMENT_PORTAL_UNAVAILABLE',
  details: 'The billing portal is not available for this subscription yet',
};
