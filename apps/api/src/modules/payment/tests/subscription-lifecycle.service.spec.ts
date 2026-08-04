import { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { ActivateFromCheckoutDataInterface } from '@modules/payment/interfaces/activate-from-checkout-data.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import type { RecordRenewalDataInterface } from '@modules/payment/interfaces/record-renewal-data.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { SubscriptionLifecycleService } from '@modules/payment/services/subscription-lifecycle.service.js';
import { SubscriptionStatusEnum, TransactionStatusEnum } from '@nest-aws-starter/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function fakePlan(overrides: Partial<PlanInterface> = {}): PlanInterface {
  return {
    id: 'plan-1',
    name: 'Pro',
    description: '',
    amountCents: 1900,
    currency: 'USD',
    intervalDays: 30,
    providerRefs: { STRIPE: 'price_1' },
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function fakeSubscription(overrides: Partial<SubscriptionInterface> = {}): SubscriptionInterface {
  return {
    id: 'sub-row-1',
    userId: 'user-1',
    planId: 'plan-1',
    planName: 'Pro',
    amountCents: 1900,
    currency: 'USD',
    status: SubscriptionStatusEnum.ACTIVE,
    provider: 'STRIPE',
    providerRef: 'sub_1',
    providerCustomerRef: 'cus_1',
    currentPeriodEndsAt: new Date('2026-09-01T00:00:00Z'),
    canceledAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

describe('SubscriptionLifecycleService', () => {
  let subscriptionRepository: SubscriptionRepositoryInterface;
  let transactionRepository: PaymentTransactionRepositoryInterface;
  let planRepository: PlanRepositoryInterface;
  let eventBus: EventBusService;
  let service: SubscriptionLifecycleService;

  beforeEach(() => {
    subscriptionRepository = {
      findCurrentByUserId: vi.fn(),
      findLatestByUserId: vi.fn(),
      createFromCheckout: vi.fn(),
      findByProviderRef: vi.fn(),
      updatePeriodEnd: vi.fn(),
      updateStatus: vi.fn(),
      setCanceledAt: vi.fn(),
      findOverdue: vi.fn(),
    };
    transactionRepository = { createIdempotent: vi.fn() };
    planRepository = { findActiveById: vi.fn(), findManyActive: vi.fn() };
    eventBus = { emit: vi.fn() } as unknown as EventBusService;
    service = new SubscriptionLifecycleService(
      subscriptionRepository,
      transactionRepository,
      planRepository,
      eventBus,
    );
  });

  describe('activateFromCheckout', () => {
    const baseData: ActivateFromCheckoutDataInterface = {
      provider: 'STRIPE',
      checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
      subscriptionRef: 'sub_1',
      periodEndsAt: new Date('2026-09-01T00:00:00Z'),
    };

    it('skips when subscriptionRef is missing', async () => {
      await service.activateFromCheckout({ ...baseData, subscriptionRef: undefined });

      expect(planRepository.findActiveById).not.toHaveBeenCalled();
      expect(subscriptionRepository.createFromCheckout).not.toHaveBeenCalled();
    });

    it('skips when the plan cannot be found', async () => {
      vi.mocked(planRepository.findActiveById).mockResolvedValue(null);

      await service.activateFromCheckout(baseData);

      expect(subscriptionRepository.createFromCheckout).not.toHaveBeenCalled();
    });

    it('creates the subscription with the given periodEndsAt and emits activated on a new row', async () => {
      vi.mocked(planRepository.findActiveById).mockResolvedValue(fakePlan());
      vi.mocked(subscriptionRepository.createFromCheckout).mockResolvedValue({
        subscription: fakeSubscription(),
        isNew: true,
      });

      await service.activateFromCheckout(baseData);

      expect(subscriptionRepository.createFromCheckout).toHaveBeenCalledWith({
        userId: 'user-1',
        planId: 'plan-1',
        provider: 'STRIPE',
        providerRef: 'sub_1',
        providerCustomerRef: 'cus_1',
        currentPeriodEndsAt: baseData.periodEndsAt,
      });
      expect(eventBus.emit).toHaveBeenCalledWith('subscription.activated', {
        userId: 'user-1',
        subscriptionId: 'sub-row-1',
        planId: 'plan-1',
      });
    });

    it('derives currentPeriodEndsAt from the plan interval when the event carries none', async () => {
      vi.mocked(planRepository.findActiveById).mockResolvedValue(fakePlan({ intervalDays: 30 }));
      vi.mocked(subscriptionRepository.createFromCheckout).mockResolvedValue({
        subscription: fakeSubscription(),
        isNew: true,
      });

      await service.activateFromCheckout({ ...baseData, periodEndsAt: undefined });

      const call = vi.mocked(subscriptionRepository.createFromCheckout).mock.calls[0]?.[0];

      expect(call?.currentPeriodEndsAt).toBeInstanceOf(Date);
      expect(call?.currentPeriodEndsAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('does not re-emit activated on a replayed checkout (isNew=false)', async () => {
      vi.mocked(planRepository.findActiveById).mockResolvedValue(fakePlan());
      vi.mocked(subscriptionRepository.createFromCheckout).mockResolvedValue({
        subscription: fakeSubscription(),
        isNew: false,
      });

      await service.activateFromCheckout(baseData);

      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('recordRenewal', () => {
    const baseData: RecordRenewalDataInterface = {
      provider: 'STRIPE',
      subscriptionRef: 'sub_1',
      periodEndsAt: new Date('2026-10-01T00:00:00Z'),
      transactionData: {
        providerRef: 'in_1',
        amountCents: 1900,
        currency: 'USD',
        status: TransactionStatusEnum.SUCCEEDED,
      },
    };

    it('no-ops when the subscription is unknown locally', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(null);

      await service.recordRenewal(baseData);

      expect(transactionRepository.createIdempotent).not.toHaveBeenCalled();
    });

    it('extends the period and emits renewed on a new transaction', async () => {
      const subscription = fakeSubscription();
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(subscription);
      vi.mocked(transactionRepository.createIdempotent).mockResolvedValue({
        transaction: {
          id: 'txn-1',
          userId: subscription.userId,
          subscriptionId: subscription.id,
          status: TransactionStatusEnum.SUCCEEDED,
          amountCents: 1900,
          currency: 'USD',
          provider: 'STRIPE',
          providerRef: 'in_1',
          createdAt: new Date(),
        },
        isNew: true,
      });

      await service.recordRenewal(baseData);

      expect(subscriptionRepository.updatePeriodEnd).toHaveBeenCalledWith(
        subscription.id,
        baseData.periodEndsAt,
      );
      expect(eventBus.emit).toHaveBeenCalledWith('subscription.renewed', {
        userId: subscription.userId,
        subscriptionId: subscription.id,
      });
    });

    it('does not double-extend or re-emit on a replayed payment (isNew=false)', async () => {
      const subscription = fakeSubscription();
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(subscription);
      vi.mocked(transactionRepository.createIdempotent).mockResolvedValue({
        transaction: {
          id: 'txn-1',
          userId: subscription.userId,
          subscriptionId: subscription.id,
          status: TransactionStatusEnum.SUCCEEDED,
          amountCents: 1900,
          currency: 'USD',
          provider: 'STRIPE',
          providerRef: 'in_1',
          createdAt: new Date(),
        },
        isNew: false,
      });

      await service.recordRenewal(baseData);

      expect(subscriptionRepository.updatePeriodEnd).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('markPastDue', () => {
    it('no-ops when the subscription is unknown locally', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(null);

      await service.markPastDue('STRIPE', 'sub_1');

      expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('transitions ACTIVE to PAST_DUE and emits', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(fakeSubscription());

      await service.markPastDue('STRIPE', 'sub_1');

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        'sub-row-1',
        SubscriptionStatusEnum.PAST_DUE,
      );
      expect(eventBus.emit).toHaveBeenCalledWith('subscription.past-due', {
        userId: 'user-1',
        subscriptionId: 'sub-row-1',
      });
    });

    it('is a no-op when already PAST_DUE (idempotent replay)', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(
        fakeSubscription({ status: SubscriptionStatusEnum.PAST_DUE }),
      );

      await service.markPastDue('STRIPE', 'sub_1');

      expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('no-ops when the subscription is unknown locally', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(null);

      await service.cancel('STRIPE', 'sub_1', true);

      expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('transitions ACTIVE to CANCELED, stamps canceledAt, and emits', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(fakeSubscription());

      await service.cancel('STRIPE', 'sub_1', true);

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        'sub-row-1',
        SubscriptionStatusEnum.CANCELED,
      );
      expect(subscriptionRepository.setCanceledAt).toHaveBeenCalledWith(
        'sub-row-1',
        expect.any(Date),
      );
      expect(eventBus.emit).toHaveBeenCalledWith('subscription.canceled', {
        userId: 'user-1',
        subscriptionId: 'sub-row-1',
      });
    });

    it.each([
      SubscriptionStatusEnum.CANCELED,
      SubscriptionStatusEnum.EXPIRED,
    ])('is a no-op when already %s (idempotent replay)', async (status) => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(
        fakeSubscription({ status }),
      );

      await service.cancel('STRIPE', 'sub_1', false);

      expect(subscriptionRepository.updateStatus).not.toHaveBeenCalled();
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('syncPeriodFromProvider', () => {
    it('no-ops when the subscription is unknown locally', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(null);

      await service.syncPeriodFromProvider('STRIPE', 'sub_1', new Date('2026-10-01T00:00:00Z'));

      expect(subscriptionRepository.updatePeriodEnd).not.toHaveBeenCalled();
    });

    it('extends the period via the guarded repository method', async () => {
      vi.mocked(subscriptionRepository.findByProviderRef).mockResolvedValue(fakeSubscription());
      const periodEndsAt = new Date('2026-10-01T00:00:00Z');

      await service.syncPeriodFromProvider('STRIPE', 'sub_1', periodEndsAt);

      expect(subscriptionRepository.updatePeriodEnd).toHaveBeenCalledWith(
        'sub-row-1',
        periodEndsAt,
      );
    });
  });

  describe('expireOverdue', () => {
    it('expires every overdue subscription and emits one event per row', async () => {
      const overdue = [
        fakeSubscription({ id: 'sub-a', userId: 'user-a' }),
        fakeSubscription({ id: 'sub-b', userId: 'user-b' }),
      ];
      vi.mocked(subscriptionRepository.findOverdue).mockResolvedValue(overdue);

      await service.expireOverdue();

      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        'sub-a',
        SubscriptionStatusEnum.EXPIRED,
      );
      expect(subscriptionRepository.updateStatus).toHaveBeenCalledWith(
        'sub-b',
        SubscriptionStatusEnum.EXPIRED,
      );
      expect(eventBus.emit).toHaveBeenCalledTimes(2);
    });

    it('queries with a cutoff that has the grace period subtracted', async () => {
      vi.mocked(subscriptionRepository.findOverdue).mockResolvedValue([]);
      const before = Date.now();

      await service.expireOverdue();

      const cutoff = vi.mocked(subscriptionRepository.findOverdue).mock.calls[0]?.[0] as Date;
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(threeDaysMs - 1000);
    });
  });
});
