import type { PlanModel } from '@generated/prisma/models.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PlanPrismaRepository implements PlanRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async findActiveById(id: string): Promise<PlanInterface | null> {
    const plan: PlanModel | null = await this.prisma.plan.findFirst({
      where: { id, isActive: true },
    });

    return plan ? this.toDomain(plan) : null;
  }

  public async findManyActive(): Promise<PlanInterface[]> {
    const plans: PlanModel[] = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { amountCents: 'asc' },
    });

    return plans.map((plan: PlanModel): PlanInterface => this.toDomain(plan));
  }

  private toDomain(plan: PlanModel): PlanInterface {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      amountCents: plan.amountCents,
      currency: plan.currency,
      intervalDays: plan.intervalDays,
      providerRefs: (plan.providerRefs as Record<string, string> | null) ?? {},
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
