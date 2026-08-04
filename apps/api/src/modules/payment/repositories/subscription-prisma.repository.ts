import { SubscriptionStatus } from '@generated/prisma/enums.js';
import type { SubscriptionGetPayload } from '@generated/prisma/models.js';
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
