import { InternalError } from '@modules/common/errors/internal.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { CreateCheckoutDataInterface } from '@modules/payment/interfaces/create-checkout-data.interface.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderRefValidatorInterface } from '@modules/payment/interfaces/payment-provider-ref-validator.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import {
  PLAN_PROVIDER_REF_MISSING,
  STRIPE_CHECKOUT_URL_MISSING,
  WEBHOOK_SIGNATURE_INVALID,
} from '@modules/stripe/constants/stripe-errors.constants.js';
import { StripeEventMapper } from '@modules/stripe/services/stripe-event-mapper.service.js';
import type { EnabledStripeConfigType } from '@modules/stripe/types/enabled-stripe-config.type.js';
import Stripe from 'stripe';

export class StripePaymentProvider
  implements PaymentProviderInterface, PaymentProviderRefValidatorInterface
{
  public readonly name = 'STRIPE';

  private readonly logger = new CustomLoggerService(StripePaymentProvider.name);
  private readonly client: Stripe;
  private readonly mapper: StripeEventMapper = new StripeEventMapper();

  constructor(private readonly config: EnabledStripeConfigType) {
    this.client = new Stripe(config.secretKey, { apiVersion: config.apiVersion });
  }

  public async createCheckoutSession(
    data: CreateCheckoutDataInterface,
  ): Promise<CheckoutSessionInterface> {
    const priceId: string | undefined = data.plan.providerRefs.STRIPE;

    if (!priceId) throw new ValidationError(PLAN_PROVIDER_REF_MISSING);

    const session: Stripe.Checkout.Session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: data.userId,
      metadata: { planId: data.plan.id },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.config.portalReturnUrl}/billing/success`,
      cancel_url: `${this.config.portalReturnUrl}/billing/canceled`,
    });

    if (!session.url) throw new InternalError(STRIPE_CHECKOUT_URL_MISSING);

    return { url: session.url };
  }

  public async createPortalSession(customerRef: string, returnUrl: string): Promise<string> {
    const session: Stripe.BillingPortal.Session = await this.client.billingPortal.sessions.create({
      customer: customerRef,
      return_url: returnUrl,
    });

    return session.url;
  }

  // Used by PlanAdminService when a plan's providerRefs.STRIPE is set or
  // changed — confirms the price actually exists in this Stripe account
  // before the plan is offered for checkout.
  public async validateProviderRef(ref: string): Promise<boolean> {
    try {
      await this.client.prices.retrieve(ref);

      return true;
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Stripe price ref invalid (${ref}): ${message}`);

      return false;
    }
  }

  public async verifyAndParseWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<ProviderEventInterface> {
    const event: Stripe.Event = this.constructEvent(rawBody, signature);

    return this.mapper.map(event);
  }

  private constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      return this.client.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);

      this.logger.warn(`Webhook signature verification failed: ${message}`);

      throw new ValidationError(WEBHOOK_SIGNATURE_INVALID);
    }
  }
}
