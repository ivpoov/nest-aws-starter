import type { WebAppConfig } from '@configs/web-app.config.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderCancellationInterface } from '@modules/payment/interfaces/payment-provider-cancellation.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { BillingService } from '@modules/payment/services/billing.service.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const webApp: WebAppConfig = { baseUrl: 'http://localhost:5173' };

const plan: PlanInterface = {
  id: '01890a5d-0000-774b-bcce-b302099a0001',
  name: 'Pro',
  description: '',
  amountCents: 1900,
  currency: 'USD',
  intervalDays: 30,
  providerRefs: { STRIPE: 'price_123' },
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

const subscription: SubscriptionInterface = {
  id: '01890a5d-0000-774b-bcce-b302099a0002',
  userId: 'user-1',
  planId: plan.id,
  planName: plan.name,
  amountCents: plan.amountCents,
  currency: plan.currency,
  status: SubscriptionStatusEnum.ACTIVE,
  provider: 'STRIPE',
  providerRef: 'sub_123',
  providerCustomerRef: 'cus_123',
  currentPeriodEndsAt: new Date('2026-09-01T00:00:00Z'),
  canceledAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

const fakeCheckoutSession: CheckoutSessionInterface = { url: 'https://fake.provider/checkout' };

function fakeProvider(overrides: Partial<PaymentProviderInterface> = {}): PaymentProviderInterface {
  return {
    name: 'STRIPE',
    createCheckoutSession: vi.fn().mockResolvedValue(fakeCheckoutSession),
    createPortalSession: vi.fn().mockResolvedValue('https://fake.provider/portal'),
    verifyAndParseWebhook: vi.fn(),
    ...overrides,
  };
}

function fakeProviderWithCancellation(): PaymentProviderInterface &
  PaymentProviderCancellationInterface {
  return {
    ...fakeProvider(),
    cancelAtPeriodEnd: vi.fn().mockResolvedValue(undefined),
  };
}

interface TestSetupInterface {
  readonly service: BillingService;
  readonly planRepository: PlanRepositoryInterface;
  readonly subscriptionRepository: SubscriptionRepositoryInterface;
  readonly lifecycle: SubscriptionLifecycleInterface;
  readonly registry: PaymentProviderRegistryService;
}

function createService(
  options: {
    provider?: PaymentProviderInterface | null;
    plan?: PlanInterface | null;
    subscription?: SubscriptionInterface | null;
    canceledSubscription?: SubscriptionInterface | null;
  } = {},
): TestSetupInterface {
  // Billing only ever reads the two active-plan lookups. `satisfies` keeps both
  // names and signatures checked against the real interface; the cast covers
  // the methods deliberately left off, which fail loudly if anything reaches
  // for them.
  const planStubs = {
    findActiveById: vi.fn().mockResolvedValue(options.plan === undefined ? plan : options.plan),
    findManyActive: vi.fn().mockResolvedValue([plan]),
  } satisfies Partial<PlanRepositoryInterface>;
  const planRepository: PlanRepositoryInterface = planStubs as unknown as PlanRepositoryInterface;
  const subscriptionRepository: SubscriptionRepositoryInterface = {
    findCurrentByUserId: vi
      .fn()
      .mockResolvedValue(options.subscription === undefined ? subscription : options.subscription),
    findLatestByUserId: vi.fn(),
    createFromCheckout: vi.fn(),
    findByProviderRef: vi
      .fn()
      .mockResolvedValue(
        options.canceledSubscription === undefined
          ? { ...subscription, status: SubscriptionStatusEnum.CANCELED, canceledAt: new Date() }
          : options.canceledSubscription,
      ),
    updatePeriodEnd: vi.fn(),
    updateStatus: vi.fn(),
    setCanceledAt: vi.fn(),
    findOverdue: vi.fn(),
  };
  const lifecycle: SubscriptionLifecycleInterface = {
    activateFromCheckout: vi.fn(),
    recordRenewal: vi.fn(),
    markPastDue: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    syncPeriodFromProvider: vi.fn(),
    expireOverdue: vi.fn(),
  };
  const registry: PaymentProviderRegistryService = new PaymentProviderRegistryService();

  if (options.provider !== null) {
    registry.register(options.provider ?? fakeProvider());
  }

  const service: BillingService = new BillingService(
    webApp,
    planRepository,
    subscriptionRepository,
    lifecycle,
    registry,
  );

  return { service, planRepository, subscriptionRepository, lifecycle, registry };
}

describe('BillingService.createCheckoutSession', () => {
  it('resolves the plan and returns the provider checkout session', async () => {
    const provider = fakeProvider();
    const { service } = createService({ provider });

    const session: CheckoutSessionInterface = await service.createCheckoutSession(
      'user-1',
      plan.id,
    );

    expect(session).toEqual(fakeCheckoutSession);
    expect(provider.createCheckoutSession).toHaveBeenCalledWith({ userId: 'user-1', plan });
  });

  it('throws PLAN_NOT_FOUND for a missing or inactive plan', async () => {
    const { service } = createService({ plan: null });

    const caught: unknown = await service
      .createCheckoutSession('user-1', 'missing-plan')
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).args.code).toBe('PLAN_NOT_FOUND');
  });

  it('throws PAYMENT_PROVIDER_NOT_ENABLED when no provider is registered', async () => {
    const { service } = createService({ provider: null });

    const caught: unknown = await service
      .createCheckoutSession('user-1', plan.id)
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).args.code).toBe('PAYMENT_PROVIDER_NOT_ENABLED');
  });
});

describe('BillingService.getCurrentSubscription', () => {
  it('returns the current subscription', async () => {
    const { service } = createService();

    await expect(service.getCurrentSubscription('user-1')).resolves.toEqual(subscription);
  });

  it('throws PAYMENT_NO_SUBSCRIPTION when there is none', async () => {
    const { service } = createService({ subscription: null });

    const caught: unknown = await service
      .getCurrentSubscription('user-1')
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).args.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });
});

describe('BillingService.createPortalSession', () => {
  it('resolves the customer ref and returns the provider portal url', async () => {
    const provider = fakeProvider();
    const { service } = createService({ provider });

    const url: string = await service.createPortalSession('user-1');

    expect(url).toBe('https://fake.provider/portal');
    expect(provider.createPortalSession).toHaveBeenCalledWith(
      subscription.providerCustomerRef,
      `${webApp.baseUrl}/billing`,
    );
  });

  it('throws PAYMENT_NO_SUBSCRIPTION when there is no current subscription', async () => {
    const { service } = createService({ subscription: null });

    const caught: unknown = await service
      .createPortalSession('user-1')
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).args.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });

  it('throws PAYMENT_PORTAL_UNAVAILABLE when the subscription has no stored customer ref', async () => {
    const { service } = createService({
      subscription: { ...subscription, providerCustomerRef: null },
    });

    const caught: unknown = await service
      .createPortalSession('user-1')
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).args.code).toBe('PAYMENT_PORTAL_UNAVAILABLE');
  });
});

describe('BillingService.listActivePlans', () => {
  it('returns the active plans from the repository', async () => {
    const { service, planRepository } = createService();

    await expect(service.listActivePlans()).resolves.toEqual([plan]);
    expect(planRepository.findManyActive).toHaveBeenCalled();
  });
});

describe('BillingService.cancelSubscription', () => {
  it('cancels through the provider then the lifecycle, and returns the updated row', async () => {
    const provider = fakeProviderWithCancellation();
    const canceledSubscription: SubscriptionInterface = {
      ...subscription,
      status: SubscriptionStatusEnum.CANCELED,
      canceledAt: new Date('2026-08-04T00:00:00Z'),
    };
    const { service, lifecycle } = createService({ provider, canceledSubscription });

    const result: SubscriptionInterface = await service.cancelSubscription('user-1');

    expect(provider.cancelAtPeriodEnd).toHaveBeenCalledWith(subscription.providerRef);
    expect(lifecycle.cancel).toHaveBeenCalledWith(
      subscription.provider,
      subscription.providerRef,
      true,
    );
    expect(result).toEqual(canceledSubscription);
  });

  it('falls back to a local-only cancel when the provider has no cancellation support', async () => {
    const provider = fakeProvider();
    const { service, lifecycle } = createService({ provider });

    await service.cancelSubscription('user-1');

    expect(lifecycle.cancel).toHaveBeenCalledWith(
      subscription.provider,
      subscription.providerRef,
      true,
    );
  });

  it('cancels locally even when no provider is registered', async () => {
    const { service, lifecycle } = createService({ provider: null });

    await expect(service.cancelSubscription('user-1')).resolves.toBeDefined();
    expect(lifecycle.cancel).toHaveBeenCalledWith(
      subscription.provider,
      subscription.providerRef,
      true,
    );
  });

  it('throws PAYMENT_NO_SUBSCRIPTION when there is no current subscription', async () => {
    const { service } = createService({ subscription: null });

    const caught: unknown = await service
      .cancelSubscription('user-1')
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).args.code).toBe('PAYMENT_NO_SUBSCRIPTION');
  });
});
