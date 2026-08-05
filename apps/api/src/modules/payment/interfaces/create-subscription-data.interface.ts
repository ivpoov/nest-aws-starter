// Built by SubscriptionLifecycleService.activateFromCheckout from the
// normalized CHECKOUT_COMPLETED event — everything the repository needs to
// insert the initial ACTIVE row. status is always ACTIVE at creation time,
// so it is not a field here — the repository hardcodes it.
export interface CreateSubscriptionDataInterface {
  readonly userId: string;
  readonly planId: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly providerCustomerRef: string;
  readonly currentPeriodEndsAt: Date;
}
