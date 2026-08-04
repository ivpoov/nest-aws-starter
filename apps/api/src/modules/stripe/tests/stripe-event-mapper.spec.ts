import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import { StripeEventMapper } from '@modules/stripe/services/stripe-event-mapper.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';

// Fixtures are hand-written minimal JSON — id/type/data.object with only
// the fields this mapper reads — never a live Stripe payload. Loaded via
// fs+JSON.parse (not a static import) to avoid depending on resolveJsonModule.
function loadFixture(name: string): Stripe.Event {
  const path: string = fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url));

  return JSON.parse(readFileSync(path, 'utf-8')) as Stripe.Event;
}

describe('StripeEventMapper', () => {
  const mapper: StripeEventMapper = new StripeEventMapper();

  it('maps checkout.session.completed to CHECKOUT_COMPLETED', () => {
    const event: ProviderEventInterface = mapper.map(loadFixture('checkout-session-completed'));

    expect(event).toEqual({
      providerEventId: 'evt_test_checkout_completed',
      type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
      subscriptionRef: 'sub_test_1',
      checkoutData: {
        userId: 'user_123',
        planId: 'plan_123',
        customerRef: 'cus_test_1',
      },
    });
  });

  it('maps invoice.paid to PAYMENT_SUCCEEDED with transaction data and period end', () => {
    const event: ProviderEventInterface = mapper.map(loadFixture('invoice-paid'));

    expect(event).toEqual({
      providerEventId: 'evt_test_invoice_paid',
      type: NormalizedEventTypeEnum.PAYMENT_SUCCEEDED,
      subscriptionRef: 'sub_test_1',
      transactionData: {
        providerRef: 'in_test_paid_1',
        amountCents: 1999,
        currency: 'USD',
        status: TransactionStatusEnum.SUCCEEDED,
      },
      periodEndsAt: new Date(1752678400 * 1000),
    });
  });

  it('maps invoice.payment_failed to PAYMENT_FAILED without a period end', () => {
    const event: ProviderEventInterface = mapper.map(loadFixture('invoice-payment-failed'));

    expect(event).toEqual({
      providerEventId: 'evt_test_invoice_failed',
      type: NormalizedEventTypeEnum.PAYMENT_FAILED,
      subscriptionRef: 'sub_test_1',
      transactionData: {
        providerRef: 'in_test_failed_1',
        amountCents: 1999,
        currency: 'USD',
        status: TransactionStatusEnum.FAILED,
      },
    });
  });

  it('maps customer.subscription.updated to SUBSCRIPTION_UPDATED with cancellation hint', () => {
    const event: ProviderEventInterface = mapper.map(loadFixture('customer-subscription-updated'));

    expect(event).toEqual({
      providerEventId: 'evt_test_sub_updated',
      type: NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED,
      subscriptionRef: 'sub_test_1',
      periodEndsAt: new Date(1752678400 * 1000),
      canceledAtPeriodEnd: true,
    });
  });

  it('maps customer.subscription.deleted to SUBSCRIPTION_CANCELED', () => {
    const event: ProviderEventInterface = mapper.map(loadFixture('customer-subscription-deleted'));

    expect(event).toEqual({
      providerEventId: 'evt_test_sub_deleted',
      type: NormalizedEventTypeEnum.SUBSCRIPTION_CANCELED,
      subscriptionRef: 'sub_test_1',
      periodEndsAt: new Date(1752678400 * 1000),
    });
  });

  it('maps every other event type to UNHANDLED', () => {
    const event: ProviderEventInterface = mapper.map(loadFixture('customer-created-unhandled'));

    expect(event).toEqual({
      providerEventId: 'evt_test_unhandled',
      type: NormalizedEventTypeEnum.UNHANDLED,
    });
  });
});
