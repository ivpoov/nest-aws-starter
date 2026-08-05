import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { SUBSCRIPTION_LIFECYCLE } from '@modules/payment/constants/payment.constants.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import { Inject, Injectable } from '@nestjs/common';

// Maps a normalized event to its SubscriptionLifecycleInterface target. The
// row's provider (WebhookEventInterface.provider) is threaded through to
// every lifecycle call because the local Subscription's identity key is the
// (provider, providerRef) pair — the lifecycle service has no other way to
// resolve which row a bare subscriptionRef refers to.
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
        return this.dispatchPaymentSucceeded(event.provider, payload);
      case NormalizedEventTypeEnum.PAYMENT_FAILED:
        return this.dispatchPaymentFailed(event.provider, payload);
      case NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED:
        return this.dispatchSubscriptionUpdated(event.provider, payload);
      case NormalizedEventTypeEnum.SUBSCRIPTION_CANCELED:
        return this.dispatchSubscriptionCanceled(event.provider, payload);
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

  private async dispatchPaymentSucceeded(
    provider: string,
    payload: ProviderEventInterface,
  ): Promise<void> {
    if (!payload.subscriptionRef || !payload.transactionData || !payload.periodEndsAt) {
      this.logger.warn('PAYMENT_SUCCEEDED event missing required fields — skipping dispatch');

      return;
    }

    await this.lifecycle.recordRenewal({
      provider,
      subscriptionRef: payload.subscriptionRef,
      periodEndsAt: new Date(payload.periodEndsAt),
      transactionData: payload.transactionData,
    });
  }

  private async dispatchPaymentFailed(
    provider: string,
    payload: ProviderEventInterface,
  ): Promise<void> {
    if (!payload.subscriptionRef) {
      this.logger.warn('PAYMENT_FAILED event missing subscriptionRef — skipping dispatch');

      return;
    }

    await this.lifecycle.markPastDue(provider, payload.subscriptionRef);
  }

  // Stripe's `customer.subscription.updated` fires on ANY field change (plan
  // swap, quantity, trial end, discounts, ...), not only when
  // cancel_at_period_end toggles. canceledAtPeriodEnd=true routes to a
  // cancel; otherwise the only thing this starter's local row can
  // meaningfully reconcile is the current period end, so a present
  // periodEndsAt routes to syncPeriodFromProvider and anything else is a
  // deliberate no-op — the breadth of the underlying Stripe event is safe to
  // ignore beyond those two fields for now.
  private async dispatchSubscriptionUpdated(
    provider: string,
    payload: ProviderEventInterface,
  ): Promise<void> {
    if (!payload.subscriptionRef) {
      this.logger.warn('SUBSCRIPTION_UPDATED event missing subscriptionRef — skipping dispatch');

      return;
    }

    if (payload.canceledAtPeriodEnd === true) {
      await this.lifecycle.cancel(provider, payload.subscriptionRef, true);

      return;
    }

    if (!payload.periodEndsAt) {
      this.logger.debug('SUBSCRIPTION_UPDATED event carries nothing actionable — no-op');

      return;
    }

    await this.lifecycle.syncPeriodFromProvider(
      provider,
      payload.subscriptionRef,
      new Date(payload.periodEndsAt),
    );
  }

  private async dispatchSubscriptionCanceled(
    provider: string,
    payload: ProviderEventInterface,
  ): Promise<void> {
    if (!payload.subscriptionRef) {
      this.logger.warn('SUBSCRIPTION_CANCELED event missing subscriptionRef — skipping dispatch');

      return;
    }

    await this.lifecycle.cancel(
      provider,
      payload.subscriptionRef,
      payload.canceledAtPeriodEnd ?? false,
    );
  }
}
