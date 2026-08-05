import { Prisma } from '@generated/prisma/client.js';
import { SubscriptionStatus } from '@generated/prisma/enums.js';
import type { SubscriptionGetPayload } from '@generated/prisma/models.js';
import type { CreateSubscriptionDataInterface } from '@modules/payment/interfaces/create-subscription-data.interface.js';
import type { CreateSubscriptionResultInterface } from '@modules/payment/interfaces/create-subscription-result.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

type SubscriptionWithPlan = SubscriptionGetPayload<{ include: { plan: true } }>;

@Injectable()
export class SubscriptionPrismaRepository implements SubscriptionRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async findCurrentByUserId(userId: string): Promise<SubscriptionInterface | null> {
    const subscription: SubscriptionWithPlan | null = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      },
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
      include: { plan: true },
    });

    return subscription ? this.toDomain(subscription) : null;
  }

  public async findLatestByUserId(userId: string): Promise<SubscriptionInterface | null> {
    const subscription: SubscriptionWithPlan | null = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { id: 'desc' },
      include: { plan: true },
    });

    return subscription ? this.toDomain(subscription) : null;
  }

  public async createFromCheckout(
    data: CreateSubscriptionDataInterface,
  ): Promise<CreateSubscriptionResultInterface> {
    try {
      const created: SubscriptionWithPlan = await this.prisma.subscription.create({
        data: {
          userId: data.userId,
          planId: data.planId,
          provider: data.provider,
          providerRef: data.providerRef,
          providerCustomerRef: data.providerCustomerRef,
          currentPeriodEndsAt: data.currentPeriodEndsAt,
          status: SubscriptionStatus.ACTIVE,
        },
        include: { plan: true },
      });

      return { subscription: this.toDomain(created), isNew: true };
    } catch (caught) {
      if (!this.isDuplicate(caught)) throw caught;

      const existing: SubscriptionInterface = await this.findByProviderRefOrThrow(
        data.provider,
        data.providerRef,
      );

      return { subscription: existing, isNew: false };
    }
  }

  public async findByProviderRef(
    provider: string,
    providerRef: string,
  ): Promise<SubscriptionInterface | null> {
    const subscription: SubscriptionWithPlan | null = await this.prisma.subscription.findUnique({
      where: { provider_providerRef: { provider, providerRef } },
      include: { plan: true },
    });

    return subscription ? this.toDomain(subscription) : null;
  }

  // Guarded: the WHERE clause only matches rows whose stored
  // currentPeriodEndsAt is earlier than the incoming value, so a replayed
  // renewal event never shrinks or re-applies the same extension. Returns
  // the current row regardless of whether this call actually updated it.
  public async updatePeriodEnd(id: string, periodEndsAt: Date): Promise<SubscriptionInterface> {
    await this.prisma.subscription.updateMany({
      where: { id, currentPeriodEndsAt: { lt: periodEndsAt } },
      data: { currentPeriodEndsAt: periodEndsAt },
    });

    return this.findByIdOrThrow(id);
  }

  public async updateStatus(
    id: string,
    status: SubscriptionStatusEnum,
  ): Promise<SubscriptionInterface> {
    const updated: SubscriptionWithPlan = await this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus[status] },
      include: { plan: true },
    });

    return this.toDomain(updated);
  }

  public async setCanceledAt(id: string, canceledAt: Date): Promise<SubscriptionInterface> {
    const updated: SubscriptionWithPlan = await this.prisma.subscription.update({
      where: { id },
      data: { canceledAt },
      include: { plan: true },
    });

    return this.toDomain(updated);
  }

  public async findOverdue(cutoff: Date): Promise<SubscriptionInterface[]> {
    const subscriptions: SubscriptionWithPlan[] = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        currentPeriodEndsAt: { lt: cutoff },
      },
      include: { plan: true },
    });

    return subscriptions.map(
      (subscription: SubscriptionWithPlan): SubscriptionInterface => this.toDomain(subscription),
    );
  }

  private async findByIdOrThrow(id: string): Promise<SubscriptionInterface> {
    const subscription: SubscriptionWithPlan = await this.prisma.subscription.findUniqueOrThrow({
      where: { id },
      include: { plan: true },
    });

    return this.toDomain(subscription);
  }

  private async findByProviderRefOrThrow(
    provider: string,
    providerRef: string,
  ): Promise<SubscriptionInterface> {
    const subscription: SubscriptionWithPlan = await this.prisma.subscription.findUniqueOrThrow({
      where: { provider_providerRef: { provider, providerRef } },
      include: { plan: true },
    });

    return this.toDomain(subscription);
  }

  // Same confined P2002-as-idempotency-signal extension documented in
  // webhook-event-prisma.repository.ts.
  private isDuplicate(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002';
  }

  private toDomain(subscription: SubscriptionWithPlan): SubscriptionInterface {
    return {
      id: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      planName: subscription.plan.name,
      amountCents: subscription.plan.amountCents,
      currency: subscription.plan.currency,
      status: SubscriptionStatusEnum[subscription.status],
      provider: subscription.provider,
      providerRef: subscription.providerRef,
      providerCustomerRef: subscription.providerCustomerRef,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt,
      canceledAt: subscription.canceledAt,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }
}
