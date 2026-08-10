import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import type { CheckoutEventDataInterface } from '@modules/payment/interfaces/checkout-event-data.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { ProviderTransactionDataInterface } from '@modules/payment/interfaces/provider-transaction-data.interface.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import type Stripe from 'stripe';

// Translates a verified Stripe webhook Event into the provider-neutral
// ProviderEventInterface — the only shape the lifecycle service will
// ever see. Not a Nest provider — manually constructed by
// StripePaymentProvider, same as that class itself. One private method per
// event type keeps each mapping focused and independently testable against
// a fixture.
export class StripeEventMapper {
  public map(event: Stripe.Event): ProviderEventInterface {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.mapCheckoutCompleted(event);
      case 'invoice.paid':
        return this.mapPaymentSucceeded(event);
      case 'invoice.payment_failed':
        return this.mapPaymentFailed(event);
      case 'customer.subscription.updated':
        return this.mapSubscriptionUpdated(event);
      case 'customer.subscription.deleted':
        return this.mapSubscriptionCanceled(event);
      default:
        return { providerEventId: event.id, type: NormalizedEventTypeEnum.UNHANDLED };
    }
  }

  private mapCheckoutCompleted(
    event: Stripe.CheckoutSessionCompletedEvent,
  ): ProviderEventInterface {
    const session: Stripe.Checkout.Session = event.data.object;
    const checkoutData: CheckoutEventDataInterface = {
      userId: session.client_reference_id ?? '',
      planId: session.metadata?.planId ?? '',
      customerRef: this.extractId(session.customer),
    };

    return {
      providerEventId: event.id,
      type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
      subscriptionRef: this.extractId(session.subscription) || undefined,
      checkoutData,
    };
  }

  private mapPaymentSucceeded(event: Stripe.InvoicePaidEvent): ProviderEventInterface {
    const invoice: Stripe.Invoice = event.data.object;

    return {
      providerEventId: event.id,
      type: NormalizedEventTypeEnum.PAYMENT_SUCCEEDED,
      subscriptionRef: this.extractSubscriptionRef(invoice) || undefined,
      transactionData: this.mapTransactionData(
        invoice,
        invoice.amount_paid,
        TransactionStatusEnum.SUCCEEDED,
      ),
      periodEndsAt: this.extractInvoicePeriodEnd(invoice),
    };
  }

  // No periodEndsAt: a failed payment never grants a new paid period.
  private mapPaymentFailed(event: Stripe.InvoicePaymentFailedEvent): ProviderEventInterface {
    const invoice: Stripe.Invoice = event.data.object;

    return {
      providerEventId: event.id,
      type: NormalizedEventTypeEnum.PAYMENT_FAILED,
      subscriptionRef: this.extractSubscriptionRef(invoice) || undefined,
      transactionData: this.mapTransactionData(
        invoice,
        invoice.amount_due,
        TransactionStatusEnum.FAILED,
      ),
    };
  }

  private mapSubscriptionUpdated(
    event: Stripe.CustomerSubscriptionUpdatedEvent,
  ): ProviderEventInterface {
    const subscription: Stripe.Subscription = event.data.object;

    return {
      providerEventId: event.id,
      type: NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED,
      subscriptionRef: subscription.id,
      periodEndsAt: this.extractSubscriptionPeriodEnd(subscription),
      canceledAtPeriodEnd: subscription.cancel_at_period_end,
    };
  }

  private mapSubscriptionCanceled(
    event: Stripe.CustomerSubscriptionDeletedEvent,
  ): ProviderEventInterface {
    const subscription: Stripe.Subscription = event.data.object;

    return {
      providerEventId: event.id,
      type: NormalizedEventTypeEnum.SUBSCRIPTION_CANCELED,
      subscriptionRef: subscription.id,
      periodEndsAt: this.extractSubscriptionPeriodEnd(subscription),
    };
  }

  private mapTransactionData(
    invoice: Stripe.Invoice,
    amountCents: number,
    status: TransactionStatusEnum,
  ): ProviderTransactionDataInterface {
    return {
      providerRef: invoice.id,
      amountCents,
      currency: invoice.currency.toUpperCase(),
      status,
    };
  }

  private extractSubscriptionRef(invoice: Stripe.Invoice): string {
    return this.extractId(invoice.parent?.subscription_details?.subscription ?? null);
  }

  private extractInvoicePeriodEnd(invoice: Stripe.Invoice): Date | undefined {
    const endSeconds: number | undefined = invoice.lines.data[0]?.period.end;

    return endSeconds ? new Date(endSeconds * 1000) : undefined;
  }

  private extractSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | undefined {
    const endSeconds: number | undefined = subscription.items.data[0]?.current_period_end;

    return endSeconds ? new Date(endSeconds * 1000) : undefined;
  }

  private extractId(value: string | { id: string } | null | undefined): string {
    if (typeof value === 'string') return value;

    return value?.id ?? '';
  }
}
