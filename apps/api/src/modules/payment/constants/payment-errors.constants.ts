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

// Category: NotFoundError (404) — the webhook ingest route param (`:provider`)
// resolves through the same registry checkout/portal use; an unregistered
// name (unknown, or a real provider whose config is disabled) simply does
// not exist in it, same as an unknown OAuth provider.
export const PAYMENT_PROVIDER_NOT_FOUND: ErrorArgsInterface = {
  code: 'PAYMENT_PROVIDER_NOT_FOUND',
  details: 'No payment provider is registered under this name',
};

// Category: ForbiddenError (403) — thrown by RequiresSubscriptionGuard.
export const PAYMENT_SUBSCRIPTION_REQUIRED: ErrorArgsInterface = {
  code: 'PAYMENT_SUBSCRIPTION_REQUIRED',
  details: 'An active subscription is required to access this resource',
};

// Category: ConflictError (409) — a plan with at least one subscription
// (any status, past or present) can never be deleted, only deactivated.
export const PLAN_HAS_SUBSCRIPTIONS: ErrorArgsInterface = {
  code: 'PLAN_HAS_SUBSCRIPTIONS',
  details: 'This plan has subscriptions and cannot be deleted',
};

// Category: ValidationError (400) — thrown by PlanAdminService when a
// providerRefs entry is set/changed and the target provider is enabled but
// rejects the ref (e.g. the Stripe price id does not exist).
export const PLAN_PROVIDER_REF_INVALID: ErrorArgsInterface = {
  code: 'PLAN_PROVIDER_REF_INVALID',
  details: 'The provider reference does not exist',
};
