import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { PLAN_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import {
  PLAN_HAS_SUBSCRIPTIONS,
  PLAN_NOT_FOUND,
  PLAN_PROVIDER_REF_INVALID,
} from '@modules/payment/constants/payment-errors.constants.js';
import { CreatePlanDto } from '@modules/payment/dtos/create-plan.dto.js';
import { UpdatePlanDto } from '@modules/payment/dtos/update-plan.dto.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderRefValidatorInterface } from '@modules/payment/interfaces/payment-provider-ref-validator.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanListInterface } from '@modules/payment/interfaces/plan-list.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { Inject, Injectable } from '@nestjs/common';

type ProviderWithRefValidatorType = PaymentProviderInterface & PaymentProviderRefValidatorInterface;

@Injectable()
export class PlanAdminService {
  private readonly logger = new CustomLoggerService(PlanAdminService.name);

  constructor(
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryInterface,
    private readonly providerRegistry: PaymentProviderRegistryService,
  ) {}

  public async findMany(pagination: CursorPaginationInterface): Promise<PlanListInterface> {
    const items: PlanInterface[] = await this.planRepository.findManyAfter(pagination);
    const lastItem: PlanInterface | undefined = items[items.length - 1];

    return {
      items,
      nextCursor: items.length === pagination.limit && lastItem ? lastItem.id : null,
    };
  }

  public async findByIdOrThrow(id: string): Promise<PlanInterface> {
    const plan: PlanInterface | null = await this.planRepository.findById(id);

    if (!plan) throw new NotFoundError(PLAN_NOT_FOUND);

    return plan;
  }

  public async create(dto: CreatePlanDto): Promise<PlanInterface> {
    const providerRefs: Record<string, string> = this.toProviderRefsRecord(dto.providerRefs);

    await this.validateProviderRefs(providerRefs);

    const plan: PlanInterface = await this.planRepository.create({
      name: dto.name,
      description: dto.description ?? '',
      amountCents: dto.amountCents,
      currency: dto.currency,
      intervalDays: dto.intervalDays,
      providerRefs,
    });

    this.logger.log(`Plan created: ${plan.id}`);

    return plan;
  }

  public async update(id: string, dto: UpdatePlanDto): Promise<PlanInterface> {
    await this.findByIdOrThrow(id);

    const providerRefs: Record<string, string> | undefined = dto.providerRefs
      ? this.toProviderRefsRecord(dto.providerRefs)
      : undefined;

    if (providerRefs) await this.validateProviderRefs(providerRefs);

    const plan: PlanInterface = await this.planRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
      ...(dto.currency !== undefined && { currency: dto.currency }),
      ...(dto.intervalDays !== undefined && { intervalDays: dto.intervalDays }),
      ...(providerRefs !== undefined && { providerRefs }),
    });

    this.logger.log(`Plan updated: ${id}`);

    return plan;
  }

  public async setActive(id: string, isActive: boolean): Promise<PlanInterface> {
    const existing: PlanInterface = await this.findByIdOrThrow(id);

    // Re-validate on (re)activation only — a since-revoked upstream price
    // must not silently start accepting checkouts again.
    if (isActive) await this.validateProviderRefs(existing.providerRefs);

    const plan: PlanInterface = await this.planRepository.setActive(id, isActive);

    this.logger.log(`Plan ${isActive ? 'activated' : 'deactivated'}: ${id}`);

    return plan;
  }

  public async deleteById(id: string): Promise<void> {
    await this.findByIdOrThrow(id);

    const hasSubscriptions: boolean = await this.planRepository.hasSubscriptions(id);

    if (hasSubscriptions) throw new ConflictError(PLAN_HAS_SUBSCRIPTIONS);

    await this.planRepository.deleteById(id);

    this.logger.log(`Plan deleted: ${id}`);
  }

  private toProviderRefsRecord(
    providerRefs: Record<string, string> | undefined,
  ): Record<string, string> {
    if (!providerRefs) return {};

    const entries: Array<[string, string]> = Object.entries(providerRefs).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    );

    return Object.fromEntries(entries);
  }

  private async validateProviderRefs(providerRefs: Record<string, string>): Promise<void> {
    for (const [providerName, ref] of Object.entries(providerRefs)) {
      const provider: PaymentProviderInterface | null = this.providerRegistry.get(providerName);

      if (!provider) {
        this.logger.debug(`Provider ${providerName} not enabled — skipping ref validation`);
        continue;
      }

      if (!this.hasRefValidator(provider)) {
        this.logger.debug(`Provider ${providerName} has no ref validator — skipping`);
        continue;
      }

      const isValid: boolean = await provider.validateProviderRef(ref);

      if (!isValid) throw new ValidationError(PLAN_PROVIDER_REF_INVALID);
    }
  }

  private hasRefValidator(
    provider: PaymentProviderInterface,
  ): provider is ProviderWithRefValidatorType {
    return (
      'validateProviderRef' in provider &&
      typeof (provider as Partial<PaymentProviderRefValidatorInterface>).validateProviderRef ===
        'function'
    );
  }
}
