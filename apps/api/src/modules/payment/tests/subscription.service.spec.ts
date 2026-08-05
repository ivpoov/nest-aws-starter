import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { SubscriptionService } from '@modules/payment/services/subscription.service.js';
import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

function fakeSubscription(overrides: Partial<SubscriptionInterface> = {}): SubscriptionInterface {
  return {
    id: 'sub-1',
    userId: 'user-1',
    planId: 'plan-1',
    planName: 'Pro',
    amountCents: 1900,
    currency: 'USD',
    status: SubscriptionStatusEnum.ACTIVE,
    provider: 'STRIPE',
    providerRef: 'sub_1',
    providerCustomerRef: 'cus_1',
    currentPeriodEndsAt: new Date(Date.now() + 86_400_000),
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createService(subscription: SubscriptionInterface | null): SubscriptionService {
  const repository: SubscriptionRepositoryInterface = {
    findCurrentByUserId: vi.fn(),
    findLatestByUserId: vi.fn().mockResolvedValue(subscription),
    createFromCheckout: vi.fn(),
    findByProviderRef: vi.fn(),
    updatePeriodEnd: vi.fn(),
    updateStatus: vi.fn(),
    setCanceledAt: vi.fn(),
    findOverdue: vi.fn(),
  };

  return new SubscriptionService(repository);
}

describe('SubscriptionService.hasActiveSubscription', () => {
  it('is false when the user has no subscription at all', async () => {
    const service = createService(null);

    await expect(service.hasActiveSubscription('user-1')).resolves.toBe(false);
  });

  it('is true for ACTIVE within the paid period', async () => {
    const service = createService(fakeSubscription({ status: SubscriptionStatusEnum.ACTIVE }));

    await expect(service.hasActiveSubscription('user-1')).resolves.toBe(true);
  });

  it('is true for PAST_DUE within the paid period (grace until the expiry sweep)', async () => {
    const service = createService(fakeSubscription({ status: SubscriptionStatusEnum.PAST_DUE }));

    await expect(service.hasActiveSubscription('user-1')).resolves.toBe(true);
  });

  it('is true for CANCELED still within the paid period (access until period end)', async () => {
    const service = createService(fakeSubscription({ status: SubscriptionStatusEnum.CANCELED }));

    await expect(service.hasActiveSubscription('user-1')).resolves.toBe(true);
  });

  it('is false for CANCELED past its paid period', async () => {
    const service = createService(
      fakeSubscription({
        status: SubscriptionStatusEnum.CANCELED,
        currentPeriodEndsAt: new Date(Date.now() - 86_400_000),
      }),
    );

    await expect(service.hasActiveSubscription('user-1')).resolves.toBe(false);
  });

  it('is false for EXPIRED even if currentPeriodEndsAt is somehow in the future', async () => {
    const service = createService(
      fakeSubscription({
        status: SubscriptionStatusEnum.EXPIRED,
        currentPeriodEndsAt: new Date(Date.now() + 86_400_000),
      }),
    );

    await expect(service.hasActiveSubscription('user-1')).resolves.toBe(false);
  });
});
