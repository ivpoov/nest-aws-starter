import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { CreateCheckoutDataInterface } from '@modules/payment/interfaces/create-checkout-data.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';

export interface PaymentProviderInterface {
  readonly name: string;
  createCheckoutSession(data: CreateCheckoutDataInterface): Promise<CheckoutSessionInterface>;
  createPortalSession(customerRef: string, returnUrl: string): Promise<string>;
  verifyAndParseWebhook(rawBody: Buffer, signature: string): Promise<ProviderEventInterface>;
}
