import type { PlanModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreatePlanDataInterface } from '@modules/payment/interfaces/create-plan-data.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import type { UpdatePlanDataInterface } from '@modules/payment/interfaces/update-plan-data.interface.js';
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

  public async findById(id: string): Promise<PlanInterface | null> {
    const plan: PlanModel | null = await this.prisma.plan.findUnique({ where: { id } });

    return plan ? this.toDomain(plan) : null;
  }

  public async findManyAfter(pagination: CursorPaginationInterface): Promise<PlanInterface[]> {
    const plans: PlanModel[] = await this.prisma.plan.findMany({
      take: pagination.limit,
      ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
      orderBy: { id: 'desc' },
    });

    return plans.map((plan: PlanModel): PlanInterface => this.toDomain(plan));
  }

  public async create(data: CreatePlanDataInterface): Promise<PlanInterface> {
    const plan: PlanModel = await this.prisma.plan.create({ data });

    return this.toDomain(plan);
  }

  public async update(id: string, data: UpdatePlanDataInterface): Promise<PlanInterface> {
    const plan: PlanModel = await this.prisma.plan.update({ where: { id }, data });

    return this.toDomain(plan);
  }

  public async setActive(id: string, isActive: boolean): Promise<PlanInterface> {
    const plan: PlanModel = await this.prisma.plan.update({ where: { id }, data: { isActive } });

    return this.toDomain(plan);
  }

  public async deleteById(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }

  public async hasSubscriptions(id: string): Promise<boolean> {
    const count: number = await this.prisma.subscription.count({ where: { planId: id } });

    return count > 0;
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
