import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const PLAN_PROVIDER_REF_MISSING: ErrorArgsInterface = {
  code: 'PLAN_PROVIDER_REF_MISSING',
  details: 'This plan is not configured for the Stripe provider',
};

// Category: ValidationError (400). The webhook ingest endpoint is the
// only caller — a bad/rotated signature is a malformed request from
// Stripe's perspective, not a server fault, so it maps to 400 like any
// other request the server can't trust, not 401/500.
export const WEBHOOK_SIGNATURE_INVALID: ErrorArgsInterface = {
  code: 'WEBHOOK_SIGNATURE_INVALID',
  details: 'The webhook signature could not be verified',
};

// Category: InternalError (500) — not the caller's fault. Defensive only:
// Checkout Sessions created in the default hosted_page ui_mode (the only
// mode this provider uses) always return a url. Should be unreachable in
// practice; guards the type-level `string | null`.
export const STRIPE_CHECKOUT_URL_MISSING: ErrorArgsInterface = {
  code: 'STRIPE_CHECKOUT_URL_MISSING',
  details: 'Stripe did not return a checkout URL',
};
