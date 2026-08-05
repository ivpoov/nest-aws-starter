import { SUBSCRIPTION_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

// The access question, kept separate from BillingService (which owns the
// checkout/portal HTTP flows): a subscription grants access as long as it
// hasn't reached EXPIRED and its paid period hasn't lapsed — CANCELED
// (soft-cancel) and PAST_DUE both keep access until currentPeriodEndsAt, by
// design (see SubscriptionLifecycleService.cancel's comment).
@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepositoryInterface,
  ) {}

  public async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription: SubscriptionInterface | null =
      await this.subscriptionRepository.findLatestByUserId(userId);

    if (!subscription) return false;

    if (subscription.status === SubscriptionStatusEnum.EXPIRED) return false;

    return subscription.currentPeriodEndsAt.getTime() > Date.now();
  }
}
