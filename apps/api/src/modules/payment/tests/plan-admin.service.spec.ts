import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { CreatePlanDto } from '@modules/payment/dtos/create-plan.dto.js';
import { UpdatePlanDto } from '@modules/payment/dtos/update-plan.dto.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderRefValidatorInterface } from '@modules/payment/interfaces/payment-provider-ref-validator.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PlanAdminService } from '@modules/payment/services/plan-admin.service.js';
import { describe, expect, it, vi } from 'vitest';

const plan: PlanInterface = {
  id: '01890a5d-0000-774b-bcce-b302099a0001',
  name: 'Starter Monthly',
  description: 'Monthly access',
  amountCents: 999,
  currency: 'USD',
  intervalDays: 30,
  providerRefs: {},
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
};

// Ref validation is an optional provider capability the service narrows to with
// an `in` check, so the return type has to admit it as optional — a plain
// PaymentProviderInterface cannot express the provider these tests build.
function fakeProvider(
  overrides: Partial<PaymentProviderInterface & PaymentProviderRefValidatorInterface> = {},
): PaymentProviderInterface & Partial<PaymentProviderRefValidatorInterface> {
  return {
    name: 'STRIPE',
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    verifyAndParseWebhook: vi.fn(),
    ...overrides,
  };
}

interface TestSetupInterface {
  readonly service: PlanAdminService;
  readonly planRepository: PlanRepositoryInterface;
  readonly registry: PaymentProviderRegistryService;
}

function createService(
  options: { plan?: PlanInterface | null; provider?: PaymentProviderInterface } = {},
): TestSetupInterface {
  const planRepository: PlanRepositoryInterface = {
    findActiveById: vi.fn(),
    findManyActive: vi.fn(),
    findById: vi.fn().mockResolvedValue(options.plan === undefined ? plan : options.plan),
    findManyAfter: vi.fn().mockResolvedValue([plan]),
    create: vi.fn().mockResolvedValue(plan),
    update: vi.fn().mockResolvedValue(plan),
    setActive: vi.fn().mockResolvedValue({ ...plan, isActive: false }),
    deleteById: vi.fn(),
    hasSubscriptions: vi.fn().mockResolvedValue(false),
  };
  const registry: PaymentProviderRegistryService = new PaymentProviderRegistryService();

  if (options.provider) registry.register(options.provider);

  const service: PlanAdminService = new PlanAdminService(planRepository, registry);

  return { service, planRepository, registry };
}

function createDto(overrides: Partial<CreatePlanDto> = {}): CreatePlanDto {
  return Object.assign(new CreatePlanDto(), {
    name: 'Starter Monthly',
    description: 'Monthly access',
    amountCents: 999,
    currency: 'USD',
    intervalDays: 30,
    ...overrides,
  });
}

describe('PlanAdminService.findMany', () => {
  it('returns items with a nextCursor when the page is full', async () => {
    const { service, planRepository } = createService();

    await expect(service.findMany({ cursor: null, limit: 1 })).resolves.toEqual({
      items: [plan],
      nextCursor: plan.id,
    });
    expect(planRepository.findManyAfter).toHaveBeenCalledWith({ cursor: null, limit: 1 });
  });

  it('returns a null nextCursor when the page is short', async () => {
    const { service } = createService();

    await expect(service.findMany({ cursor: null, limit: 20 })).resolves.toEqual({
      items: [plan],
      nextCursor: null,
    });
  });
});

describe('PlanAdminService.findByIdOrThrow', () => {
  it('throws PLAN_NOT_FOUND for a missing plan', async () => {
    const { service } = createService({ plan: null });

    const caught: unknown = await service
      .findByIdOrThrow('missing')
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).args.code).toBe('PLAN_NOT_FOUND');
  });
});

describe('PlanAdminService.create', () => {
  it('creates a plan with no providerRefs without touching the registry', async () => {
    const { service, planRepository } = createService();

    await service.create(createDto());

    expect(planRepository.create).toHaveBeenCalledWith({
      name: 'Starter Monthly',
      description: 'Monthly access',
      amountCents: 999,
      currency: 'USD',
      intervalDays: 30,
      providerRefs: {},
    });
  });

  it('defaults description to an empty string when omitted', async () => {
    const { service, planRepository } = createService();

    await service.create(createDto({ description: undefined }));

    expect(planRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ description: '' }),
    );
  });

  it('creates when the provider ref validates successfully', async () => {
    const provider = fakeProvider({ validateProviderRef: vi.fn().mockResolvedValue(true) });
    const { service, planRepository } = createService({ provider });

    await service.create(createDto({ providerRefs: { STRIPE: 'price_valid' } }));

    expect(provider.validateProviderRef).toHaveBeenCalledWith('price_valid');
    expect(planRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ providerRefs: { STRIPE: 'price_valid' } }),
    );
  });

  it('throws PLAN_PROVIDER_REF_INVALID when the provider rejects the ref', async () => {
    const provider = fakeProvider({ validateProviderRef: vi.fn().mockResolvedValue(false) });
    const { service, planRepository } = createService({ provider });

    const caught: unknown = await service
      .create(createDto({ providerRefs: { STRIPE: 'price_bad' } }))
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).args.code).toBe('PLAN_PROVIDER_REF_INVALID');
    expect(planRepository.create).not.toHaveBeenCalled();
  });

  it('skips validation when the provider is not registered (disabled)', async () => {
    const { service, planRepository } = createService();

    await service.create(createDto({ providerRefs: { STRIPE: 'price_any' } }));

    expect(planRepository.create).toHaveBeenCalled();
  });

  it('skips validation when the provider does not implement a ref validator', async () => {
    const provider = fakeProvider();
    const { service, planRepository } = createService({ provider });

    await service.create(createDto({ providerRefs: { STRIPE: 'price_any' } }));

    expect(planRepository.create).toHaveBeenCalled();
  });
});

describe('PlanAdminService.update', () => {
  it('throws PLAN_NOT_FOUND for a missing plan', async () => {
    const { service } = createService({ plan: null });

    const caught: unknown = await service
      .update('missing', Object.assign(new UpdatePlanDto(), { name: 'x' }))
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(NotFoundError);
  });

  it('merges only the provided fields', async () => {
    const { service, planRepository } = createService();

    await service.update(plan.id, Object.assign(new UpdatePlanDto(), { name: 'Renamed' }));

    expect(planRepository.update).toHaveBeenCalledWith(plan.id, { name: 'Renamed' });
  });

  it('validates providerRefs when changed', async () => {
    const provider = fakeProvider({ validateProviderRef: vi.fn().mockResolvedValue(false) });
    const { service } = createService({ provider });

    const caught: unknown = await service
      .update(
        plan.id,
        Object.assign(new UpdatePlanDto(), { providerRefs: { STRIPE: 'price_bad' } }),
      )
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ValidationError);
  });
});

describe('PlanAdminService.setActive', () => {
  it('re-validates existing providerRefs when activating', async () => {
    const provider = fakeProvider({ validateProviderRef: vi.fn().mockResolvedValue(false) });
    const { service } = createService({
      provider,
      plan: { ...plan, providerRefs: { STRIPE: 'price_since_deleted' } },
    });

    const caught: unknown = await service.setActive(plan.id, true).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).args.code).toBe('PLAN_PROVIDER_REF_INVALID');
  });

  it('does not validate providerRefs when deactivating', async () => {
    const provider = fakeProvider({ validateProviderRef: vi.fn() });
    const { service, planRepository } = createService({
      provider,
      plan: { ...plan, providerRefs: { STRIPE: 'price_x' } },
    });

    await service.setActive(plan.id, false);

    expect(provider.validateProviderRef).not.toHaveBeenCalled();
    expect(planRepository.setActive).toHaveBeenCalledWith(plan.id, false);
  });
});

describe('PlanAdminService.deleteById', () => {
  it('throws PLAN_HAS_SUBSCRIPTIONS when the plan has subscriptions', async () => {
    const { service, planRepository } = createService();

    vi.mocked(planRepository.hasSubscriptions).mockResolvedValue(true);

    const caught: unknown = await service.deleteById(plan.id).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).args.code).toBe('PLAN_HAS_SUBSCRIPTIONS');
    expect(planRepository.deleteById).not.toHaveBeenCalled();
  });

  it('deletes when the plan has no subscriptions', async () => {
    const { service, planRepository } = createService();

    await service.deleteById(plan.id);

    expect(planRepository.deleteById).toHaveBeenCalledWith(plan.id);
  });

  it('throws PLAN_NOT_FOUND for a missing plan', async () => {
    const { service } = createService({ plan: null });

    const caught: unknown = await service.deleteById('missing').catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(NotFoundError);
  });
});
