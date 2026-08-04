import { stripeConfig } from '@configs/stripe.config.js';
import { InternalError } from '@modules/common/errors/internal.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { CreateCheckoutDataInterface } from '@modules/payment/interfaces/create-checkout-data.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import { StripePaymentProvider } from '@modules/stripe/providers/stripe-payment.provider.js';
import type { EnabledStripeConfigType } from '@modules/stripe/types/enabled-stripe-config.type.js';
import Stripe from 'stripe';
import { afterEach, describe, expect, it, vi } from 'vitest';

const enabledConfig: EnabledStripeConfigType = {
  isEnabled: true,
  secretKey: 'sk_test_123',
  webhookSecret: 'whsec_test_secret',
  apiVersion: '2026-06-24.dahlia',
  portalReturnUrl: 'https://app.example.com',
};

const plan: PlanInterface = {
  id: 'plan_123',
  name: 'Pro',
  description: 'Pro plan',
  amountCents: 1999,
  currency: 'USD',
  intervalDays: 30,
  providerRefs: { STRIPE: 'price_123' },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('stripeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('skips all validation when disabled', () => {
    vi.stubEnv('STRIPE_ENABLED', 'false');

    expect(stripeConfig()).toEqual({ isEnabled: false });
  });

  it('fails boot when enabled with missing variables', () => {
    vi.stubEnv('STRIPE_ENABLED', 'true');
    vi.stubEnv('STRIPE_SECRET_KEY', '');

    expect(() => stripeConfig()).toThrow(/Invalid configuration/);
  });

  it('accepts a complete enabled configuration with the pinned api version', () => {
    vi.stubEnv('STRIPE_ENABLED', 'true');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_secret');
    vi.stubEnv('STRIPE_PORTAL_RETURN_URL', 'https://app.example.com');

    expect(stripeConfig()).toEqual(enabledConfig);
  });
});

describe('StripePaymentProvider.createCheckoutSession', () => {
  it('creates a subscription-mode session and returns its url', async () => {
    const provider: StripePaymentProvider = new StripePaymentProvider(enabledConfig);
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/1' });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (provider as any).client.checkout.sessions.create = create;

    const data: CreateCheckoutDataInterface = { userId: 'user_123', plan };
    const session: CheckoutSessionInterface = await provider.createCheckoutSession(data);

    expect(session).toEqual({ url: 'https://checkout.stripe.com/c/1' });
    expect(create).toHaveBeenCalledWith({
      mode: 'subscription',
      client_reference_id: 'user_123',
      metadata: { planId: 'plan_123' },
      line_items: [{ price: 'price_123', quantity: 1 }],
      success_url: 'https://app.example.com/billing/success',
      cancel_url: 'https://app.example.com/billing/canceled',
    });
  });

  it('throws PLAN_PROVIDER_REF_MISSING when the plan has no Stripe price ref', async () => {
    const provider: StripePaymentProvider = new StripePaymentProvider(enabledConfig);
    const create = vi.fn();

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (provider as any).client.checkout.sessions.create = create;
    const unrefPlan: PlanInterface = { ...plan, providerRefs: {} };

    const caught: unknown = await provider
      .createCheckoutSession({ userId: 'user_123', plan: unrefPlan })
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).args.code).toBe('PLAN_PROVIDER_REF_MISSING');
    expect(create).not.toHaveBeenCalled();
  });

  it('throws STRIPE_CHECKOUT_URL_MISSING when Stripe returns no url', async () => {
    const provider: StripePaymentProvider = new StripePaymentProvider(enabledConfig);

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (provider as any).client.checkout.sessions.create = vi.fn().mockResolvedValue({ url: null });

    const caught: unknown = await provider
      .createCheckoutSession({ userId: 'user_123', plan })
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(InternalError);
    expect((caught as InternalError).args.code).toBe('STRIPE_CHECKOUT_URL_MISSING');
  });
});

describe('StripePaymentProvider.createPortalSession', () => {
  it('creates a billing portal session and returns its url', async () => {
    const provider: StripePaymentProvider = new StripePaymentProvider(enabledConfig);
    const create = vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/1' });

    // biome-ignore lint/suspicious/noExplicitAny: reaching into the private client for mocking
    (provider as any).client.billingPortal.sessions.create = create;

    const url: string = await provider.createPortalSession(
      'cus_123',
      'https://app.example.com/billing',
    );

    expect(url).toBe('https://billing.stripe.com/p/1');
    expect(create).toHaveBeenCalledWith({
      customer: 'cus_123',
      return_url: 'https://app.example.com/billing',
    });
  });
});

describe('StripePaymentProvider.verifyAndParseWebhook', () => {
  const payload: string = JSON.stringify({
    id: 'evt_test_1',
    type: 'customer.created',
    data: { object: { id: 'cus_1' } },
  });

  it('accepts a validly signed payload and maps it', async () => {
    const provider: StripePaymentProvider = new StripePaymentProvider(enabledConfig);
    // A separate raw Stripe client only to compute a real signature offline
    // (stripe.webhooks.generateTestHeaderString does local HMAC — no
    // network) — exercises the real constructEvent path end to end.
    const signer: Stripe = new Stripe(enabledConfig.secretKey, {
      apiVersion: enabledConfig.apiVersion,
    });
    const signature: string = signer.webhooks.generateTestHeaderString({
      payload,
      secret: enabledConfig.webhookSecret,
    });

    const event = await provider.verifyAndParseWebhook(Buffer.from(payload), signature);

    expect(event).toEqual({ providerEventId: 'evt_test_1', type: 'UNHANDLED' });
  });

  it('throws WEBHOOK_SIGNATURE_INVALID for a signature from a different secret', async () => {
    const provider: StripePaymentProvider = new StripePaymentProvider(enabledConfig);
    const signer: Stripe = new Stripe(enabledConfig.secretKey, {
      apiVersion: enabledConfig.apiVersion,
    });
    const signature: string = signer.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_wrong_secret',
    });

    const caught: unknown = await provider
      .verifyAndParseWebhook(Buffer.from(payload), signature)
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).args.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});
