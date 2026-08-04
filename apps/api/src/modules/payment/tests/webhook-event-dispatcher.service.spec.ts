import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import { WebhookEventDispatcherService } from '@modules/payment/services/webhook-event-dispatcher.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

function fakeLifecycle(): SubscriptionLifecycleInterface {
  return {
    activateFromCheckout: vi.fn().mockResolvedValue(undefined),
    recordRenewal: vi.fn().mockResolvedValue(undefined),
    markPastDue: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    syncPeriodFromProvider: vi.fn().mockResolvedValue(undefined),
    expireOverdue: vi.fn().mockResolvedValue(undefined),
  };
}

function webhookEvent(
  type: NormalizedEventTypeEnum,
  payload: Partial<ProviderEventInterface>,
): WebhookEventInterface {
  return {
    id: '01890a5d-0000-774b-bcce-b302099d0001',
    provider: 'STRIPE',
    providerEventId: 'evt_123',
    type,
    payload: { providerEventId: 'evt_123', type, ...payload } as unknown as Record<string, unknown>,
    status: WebhookEventStatusEnum.RECEIVED,
    attempts: 0,
    lastError: null,
    createdAt: new Date('2026-08-04T00:00:00Z'),
    processedAt: null,
  };
}

describe('WebhookEventDispatcherService.dispatch', () => {
  it('maps CHECKOUT_COMPLETED to activateFromCheckout', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);
    const periodEndsAt = new Date('2026-09-01T00:00:00Z');
    const event = webhookEvent(NormalizedEventTypeEnum.CHECKOUT_COMPLETED, {
      subscriptionRef: 'sub_1',
      periodEndsAt,
      checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
    });

    await service.dispatch(event);

    expect(lifecycle.activateFromCheckout).toHaveBeenCalledWith({
      provider: 'STRIPE',
      checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
      subscriptionRef: 'sub_1',
      periodEndsAt,
    });
  });

  it('skips CHECKOUT_COMPLETED with no checkoutData', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);

    await service.dispatch(webhookEvent(NormalizedEventTypeEnum.CHECKOUT_COMPLETED, {}));

    expect(lifecycle.activateFromCheckout).not.toHaveBeenCalled();
  });

  it('maps PAYMENT_SUCCEEDED to recordRenewal with the event provider', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);
    const periodEndsAt = new Date('2026-09-01T00:00:00Z');
    const transactionData = {
      providerRef: 'pi_1',
      amountCents: 1900,
      currency: 'USD',
      status: TransactionStatusEnum.SUCCEEDED,
    };

    await service.dispatch(
      webhookEvent(NormalizedEventTypeEnum.PAYMENT_SUCCEEDED, {
        subscriptionRef: 'sub_1',
        periodEndsAt,
        transactionData,
      }),
    );

    expect(lifecycle.recordRenewal).toHaveBeenCalledWith({
      provider: 'STRIPE',
      subscriptionRef: 'sub_1',
      periodEndsAt,
      transactionData,
    });
  });

  it('maps PAYMENT_FAILED to markPastDue with the event provider', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);

    await service.dispatch(
      webhookEvent(NormalizedEventTypeEnum.PAYMENT_FAILED, { subscriptionRef: 'sub_1' }),
    );

    expect(lifecycle.markPastDue).toHaveBeenCalledWith('STRIPE', 'sub_1');
  });

  it('maps SUBSCRIPTION_CANCELED to cancel with the provider and canceledAtPeriodEnd flag', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);

    await service.dispatch(
      webhookEvent(NormalizedEventTypeEnum.SUBSCRIPTION_CANCELED, {
        subscriptionRef: 'sub_1',
        canceledAtPeriodEnd: false,
      }),
    );

    expect(lifecycle.cancel).toHaveBeenCalledWith('STRIPE', 'sub_1', false);
  });

  it('maps SUBSCRIPTION_UPDATED with canceledAtPeriodEnd=true to cancel', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);

    await service.dispatch(
      webhookEvent(NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED, {
        subscriptionRef: 'sub_1',
        canceledAtPeriodEnd: true,
      }),
    );

    expect(lifecycle.cancel).toHaveBeenCalledWith('STRIPE', 'sub_1', true);
    expect(lifecycle.syncPeriodFromProvider).not.toHaveBeenCalled();
  });

  it('maps SUBSCRIPTION_UPDATED with a period end and no cancellation hint to syncPeriodFromProvider', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);
    const periodEndsAt = new Date('2026-09-01T00:00:00Z');

    await service.dispatch(
      webhookEvent(NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED, {
        subscriptionRef: 'sub_1',
        periodEndsAt,
      }),
    );

    expect(lifecycle.syncPeriodFromProvider).toHaveBeenCalledWith('STRIPE', 'sub_1', periodEndsAt);
    expect(lifecycle.cancel).not.toHaveBeenCalled();
  });

  it('no-ops on SUBSCRIPTION_UPDATED with neither a cancellation hint nor a period end', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);

    await service.dispatch(
      webhookEvent(NormalizedEventTypeEnum.SUBSCRIPTION_UPDATED, { subscriptionRef: 'sub_1' }),
    );

    expect(lifecycle.cancel).not.toHaveBeenCalled();
    expect(lifecycle.syncPeriodFromProvider).not.toHaveBeenCalled();
  });

  it('does nothing for UNHANDLED (the consumer marks it SKIPPED before ever dispatching)', async () => {
    const lifecycle = fakeLifecycle();
    const service = new WebhookEventDispatcherService(lifecycle);

    await service.dispatch(webhookEvent(NormalizedEventTypeEnum.UNHANDLED, {}));

    expect(lifecycle.activateFromCheckout).not.toHaveBeenCalled();
    expect(lifecycle.recordRenewal).not.toHaveBeenCalled();
    expect(lifecycle.markPastDue).not.toHaveBeenCalled();
    expect(lifecycle.cancel).not.toHaveBeenCalled();
  });
});
