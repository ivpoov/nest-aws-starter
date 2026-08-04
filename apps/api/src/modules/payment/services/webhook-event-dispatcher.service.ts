import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { SUBSCRIPTION_LIFECYCLE } from '@modules/payment/constants/payment.constants.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import { Inject, Injectable } from '@nestjs/common';

// Maps a normalized event to its SubscriptionLifecycleInterface target.
// SUBSCRIPTION_UPDATED and SUBSCRIPTION_CANCELED both route to `cancel` —
// the interface (plan Task 7) has no other method shaped for a bare
// "subscription changed" webhook. Stripe's own `customer.subscription.
// updated` actually fires on ANY field change (plan swap, quantity, trial
// end, discounts, ...), not only when `cancel_at_period_end` toggles — this
// dispatcher only acts on it when `canceledAtPeriodEnd` is explicitly true
// (see dispatchSubscriptionUpdated below) and is a no-op otherwise, so the
// breadth of the underlying Stripe event is safe to ignore for now. PR 7
// may extend this mapping (e.g. a real "plan changed" method) once the real
// lifecycle service exposes more transitions.
@Injectable()
export class WebhookEventDispatcherService {
  private readonly logger = new CustomLoggerService(WebhookEventDispatcherService.name);

  constructor(
    @Inject(SUBSCRIPTION_LIFECYCLE)
    private readonly lifecycle: SubscriptionLifecycleInterface,
  ) {}

  public async dispatch(event: WebhookEventInterface): Promise<void> {
    // The row's payload IS the normalized ProviderEventInterface persisted
    // by WebhookIngestService (PR 5) — Date-typed fields survive the JSON
    // round-trip as ISO strings, so every date read below goes through
    // `new Date(...)`, which safely accepts either shape.
    const payload = event.payload as unknown as ProviderEventInterface;

    switch (event.type) {
      case NormalizedEventTypeEnum.CHECKOUT_COMPLETED:
        return this.dispatchCheckoutCompleted(event.provider, payload);
      case NormalizedEventTypeEnum.PAYMENT_SUCCEEDED:
        return this.dispatchPaymentSucceeded(payload);
      case NormalizedEventTypeEnum.PAYMENT_FAILED:
        return this.dispatchPaymentFailed(payload);
      case NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED:
        return this.dispatchSubscriptionUpdated(payload);
      case NormalizedEventTypeEnum.SUBSCRIPTION_CANCELED:
        return this.dispatchSubscriptionCanceled(payload);
      default:
        this.logger.warn(
          `No dispatch target for normalized event type: ${event.type} (${event.id})`,
        );
    }
  }

  private async dispatchCheckoutCompleted(
    provider: string,
    payload: ProviderEventInterface,
  ): Promise<void> {
    if (!payload.checkoutData) {
      this.logger.warn('CHECKOUT_COMPLETED event missing checkoutData — skipping dispatch');

      return;
    }

    await this.lifecycle.activateFromCheckout({
      provider,
      checkoutData: payload.checkoutData,
      subscriptionRef: payload.subscriptionRef,
      periodEndsAt: payload.periodEndsAt ? new Date(payload.periodEndsAt) : undefined,
    });
  }

  private async dispatchPaymentSucceeded(payload: ProviderEventInterface): Promise<void> {
    if (!payload.subscriptionRef || !payload.transactionData || !payload.periodEndsAt) {
      this.logger.warn('PAYMENT_SUCCEEDED event missing required fields — skipping dispatch');

      return;
    }

    await this.lifecycle.recordRenewal({
      subscriptionRef: payload.subscriptionRef,
      periodEndsAt: new Date(payload.periodEndsAt),
      transactionData: payload.transactionData,
    });
  }

  private async dispatchPaymentFailed(payload: ProviderEventInterface): Promise<void> {
    if (!payload.subscriptionRef) {
      this.logger.warn('PAYMENT_FAILED event missing subscriptionRef — skipping dispatch');

      return;
    }

    await this.lifecycle.markPastDue(payload.subscriptionRef);
  }

  private async dispatchSubscriptionUpdated(payload: ProviderEventInterface): Promise<void> {
    if (!payload.subscriptionRef || payload.canceledAtPeriodEnd !== true) {
      this.logger.debug('SUBSCRIPTION_UPDATED event carries no cancellation hint — no-op');

      return;
    }

    await this.lifecycle.cancel(payload.subscriptionRef, true);
  }

  private async dispatchSubscriptionCanceled(payload: ProviderEventInterface): Promise<void> {
    if (!payload.subscriptionRef) {
      this.logger.warn('SUBSCRIPTION_CANCELED event missing subscriptionRef — skipping dispatch');

      return;
    }

    await this.lifecycle.cancel(payload.subscriptionRef, payload.canceledAtPeriodEnd ?? false);
  }
}
