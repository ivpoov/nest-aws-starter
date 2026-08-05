import type { CheckoutEventDataInterface } from '@modules/payment/interfaces/checkout-event-data.interface.js';

// Built by WebhookEventDispatcherService from a CHECKOUT_COMPLETED
// ProviderEventInterface — subscriptionRef/periodEndsAt are optional because
// not every provider's checkout-completed event carries the subscription id
// up front (some only confirm it on the follow-up invoice.paid).
export interface ActivateFromCheckoutDataInterface {
  readonly provider: string;
  readonly checkoutData: CheckoutEventDataInterface;
  readonly subscriptionRef: string | undefined;
  readonly periodEndsAt: Date | undefined;
}
