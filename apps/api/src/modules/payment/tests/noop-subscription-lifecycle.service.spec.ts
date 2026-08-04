import { NoopSubscriptionLifecycleService } from '@modules/payment/services/noop-subscription-lifecycle.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it } from 'vitest';

// The temporary PR 7 stand-in — proves every SubscriptionLifecycleInterface
// method resolves without throwing so the dispatcher wiring in this PR is
// exercisable end to end before the real service exists.
describe('NoopSubscriptionLifecycleService', () => {
  const service = new NoopSubscriptionLifecycleService();

  it('resolves activateFromCheckout', async () => {
    await expect(
      service.activateFromCheckout({
        provider: 'STRIPE',
        checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
        subscriptionRef: 'sub_1',
        periodEndsAt: new Date('2026-09-01T00:00:00Z'),
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves recordRenewal', async () => {
    await expect(
      service.recordRenewal({
        subscriptionRef: 'sub_1',
        periodEndsAt: new Date('2026-09-01T00:00:00Z'),
        transactionData: {
          providerRef: 'pi_1',
          amountCents: 1900,
          currency: 'USD',
          status: TransactionStatusEnum.SUCCEEDED,
        },
      }),
    ).resolves.toBeUndefined();
  });

  it('resolves markPastDue, cancel, and expireOverdue', async () => {
    await expect(service.markPastDue('sub_1')).resolves.toBeUndefined();
    await expect(service.cancel('sub_1', true)).resolves.toBeUndefined();
    await expect(service.expireOverdue()).resolves.toBeUndefined();
  });
});
