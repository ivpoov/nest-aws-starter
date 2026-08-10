// Carried on CHECKOUT_COMPLETED provider events — the lifecycle service
// needs these to create the local Subscription row. Provider-neutral:
// any provider's checkout flow maps its own fields onto this same shape.
export interface CheckoutEventDataInterface {
  readonly userId: string;
  readonly planId: string;
  readonly customerRef: string;
}
