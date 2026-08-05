// Optional secondary contract — a provider that can look up whether a
// providerRefs entry (e.g. a Stripe price id) actually exists upstream.
// PaymentProviderInterface itself stays untouched (verbatim-locked): providers
// that don't need ref validation simply don't implement this one, and
// PlanAdminService treats "no validator" the same as "provider disabled" —
// skip, log at debug.
export interface PaymentProviderRefValidatorInterface {
  validateProviderRef(ref: string): Promise<boolean>;
}
