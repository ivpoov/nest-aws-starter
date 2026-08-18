import { UNIT_OF_WORK } from '@constants/unit-of-work.constants.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import type { UnitOfWorkInterface } from '@interfaces/unit-of-work.interface.js';
import {
  SUBSCRIPTION_ACTIVATED_EVENT,
  SUBSCRIPTION_CANCELED_EVENT,
  SUBSCRIPTION_EXPIRED_EVENT,
  SUBSCRIPTION_PAST_DUE_EVENT,
  SUBSCRIPTION_RENEWED_EVENT,
} from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  PAYMENT_TRANSACTION_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '@modules/payment/constants/payment.constants.js';
import {
  EXPIRY_GRACE_PERIOD_MS,
  EXPIRY_SWEEP_BATCH_LIMIT,
} from '@modules/payment/constants/subscription-lifecycle.constants.js';
import type { ActivateFromCheckoutDataInterface } from '@modules/payment/interfaces/activate-from-checkout-data.interface.js';
import type { CreatePaymentTransactionResultInterface } from '@modules/payment/interfaces/create-payment-transaction-result.interface.js';
import type { CreateSubscriptionResultInterface } from '@modules/payment/interfaces/create-subscription-result.interface.js';
import type { PaymentTransactionRepositoryInterface } from '@modules/payment/interfaces/payment-transaction-repository.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import type { RecordRenewalDataInterface } from '@modules/payment/interfaces/record-renewal-data.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

// The only state-transition owner for subscriptions — see
// SubscriptionLifecycleInterface for the binding idempotency contract every
// method here upholds.
@Injectable()
export class SubscriptionLifecycleService implements SubscriptionLifecycleInterface {
  private readonly logger = new CustomLoggerService(SubscriptionLifecycleService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepositoryInterface,
    @Inject(PAYMENT_TRANSACTION_REPOSITORY)
    private readonly transactionRepository: PaymentTransactionRepositoryInterface,
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryInterface,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async activateFromCheckout(data: ActivateFromCheckoutDataInterface): Promise<void> {
    if (!data.subscriptionRef) {
      this.logger.warn(
        `CHECKOUT_COMPLETED with no subscriptionRef — cannot dedupe, skipping: user=${data.checkoutData.userId}`,
      );

      return;
    }

    const plan: PlanInterface | null = await this.planRepository.findActiveById(
      data.checkoutData.planId,
    );

    if (!plan) {
      this.logger.warn(`Checkout completed for unknown/inactive plan: ${data.checkoutData.planId}`);

      return;
    }

    await this.createSubscriptionFromCheckout(data, plan);
  }

  private async createSubscriptionFromCheckout(
    data: ActivateFromCheckoutDataInterface,
    plan: PlanInterface,
  ): Promise<void> {
    const subscriptionRef: string = data.subscriptionRef as string;
    const currentPeriodEndsAt: Date =
      data.periodEndsAt ?? this.addDays(new Date(), plan.intervalDays);
    const result: CreateSubscriptionResultInterface =
      await this.subscriptionRepository.createFromCheckout({
        userId: data.checkoutData.userId,
        planId: plan.id,
        provider: data.provider,
        providerRef: subscriptionRef,
        providerCustomerRef: data.checkoutData.customerRef,
        currentPeriodEndsAt,
      });

    if (!result.isNew) {
      this.logger.debug(`Checkout replay — already activated: ${result.subscription.id}`);

      return;
    }

    this.logger.log(`Subscription activated: ${result.subscription.id}`);
    this.eventBus.emit(SUBSCRIPTION_ACTIVATED_EVENT, {
      userId: result.subscription.userId,
      subscriptionId: result.subscription.id,
      planId: result.subscription.planId,
    });
  }

  public async recordRenewal(data: RecordRenewalDataInterface): Promise<void> {
    const subscription: SubscriptionInterface | null = await this.findByRefOrWarn(
      data.provider,
      data.subscriptionRef,
      'recordRenewal',
    );

    if (!subscription) return;

    // The money and the entitlement it buys move together (§7a): recording the
    // payment while failing to extend the period leaves a paying customer
    // eligible for the expiry sweep. The idempotency guards below stay — they
    // cover redelivery, which a transaction does not — but they are no longer
    // the only thing standing between a crash and a wrong period end.
    const txResult: CreatePaymentTransactionResultInterface = await this.unitOfWork.run(
      async (tx: TransactionContextInterface): Promise<CreatePaymentTransactionResultInterface> => {
        const created: CreatePaymentTransactionResultInterface =
          await this.transactionRepository.createIdempotent(
            {
              userId: subscription.userId,
              subscriptionId: subscription.id,
              status: data.transactionData.status,
              amountCents: data.transactionData.amountCents,
              currency: data.transactionData.currency,
              provider: data.provider,
              providerRef: data.transactionData.providerRef,
            },
            tx,
          );

        // Even on replay (isNew=false), the period extension must still run: it
        // is monotonic-guarded in the repository, so a harmless no-op if already
        // applied, and load-bearing if a prior attempt recorded the transaction
        // but crashed before extending the period (see
        // subscription-lifecycle.service.ts's binding idempotency contract).
        await this.subscriptionRepository.updatePeriodEnd(subscription.id, data.periodEndsAt, tx);

        return created;
      },
    );

    if (!txResult.isNew) {
      this.logger.debug(
        `Renewal replay — transaction already recorded: ${txResult.transaction.id}`,
      );

      return;
    }

    this.logger.log(`Subscription renewed: ${subscription.id}`);
    this.eventBus.emit(SUBSCRIPTION_RENEWED_EVENT, {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    });
  }

  public async markPastDue(provider: string, subscriptionRef: string): Promise<void> {
    const subscription: SubscriptionInterface | null = await this.findByRefOrWarn(
      provider,
      subscriptionRef,
      'markPastDue',
    );

    if (!subscription) return;

    if (subscription.status !== SubscriptionStatusEnum.ACTIVE) {
      this.logger.debug(`markPastDue no-op — status is ${subscription.status}: ${subscription.id}`);

      return;
    }

    await this.subscriptionRepository.updateStatus(
      subscription.id,
      SubscriptionStatusEnum.PAST_DUE,
    );

    this.logger.log(`Subscription past due: ${subscription.id}`);
    this.eventBus.emit(SUBSCRIPTION_PAST_DUE_EVENT, {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    });
  }

  // canceledAtPeriodEnd is accepted for interface/logging symmetry with the
  // provider's own flag, but not otherwise acted on: this starter has no
  // column to record an immediate hard-cutoff separately from "access until
  // period end", so every cancel keeps access until currentPeriodEndsAt —
  // the expiry job (not this method) is what eventually revokes it. A richer
  // model that hard-cuts access on canceledAtPeriodEnd=false is future work.
  public async cancel(
    provider: string,
    subscriptionRef: string,
    canceledAtPeriodEnd: boolean,
  ): Promise<void> {
    const subscription: SubscriptionInterface | null = await this.findByRefOrWarn(
      provider,
      subscriptionRef,
      'cancel',
    );

    if (!subscription) return;

    if (this.isTerminal(subscription.status)) {
      this.logger.debug(`cancel no-op — status is ${subscription.status}: ${subscription.id}`);

      return;
    }

    // One unit of work, not two writes (§7a). The guard above short-circuits on
    // a terminal status, so a crash between the two statements would have left
    // this row CANCELED with canceledAt = null FOREVER — no redelivery can
    // repair it, because every replay returns at that guard. Rolling both back
    // keeps the row ACTIVE and therefore still repairable by the next delivery.
    await this.unitOfWork.run(async (tx: TransactionContextInterface): Promise<void> => {
      await this.subscriptionRepository.updateStatus(
        subscription.id,
        SubscriptionStatusEnum.CANCELED,
        tx,
      );
      await this.subscriptionRepository.setCanceledAt(subscription.id, new Date(), tx);
    });

    // Side effects stay outside the unit: a rollback cannot un-emit an event.
    this.logger.log(
      `Subscription canceled: ${subscription.id} (atPeriodEnd=${canceledAtPeriodEnd})`,
    );
    this.eventBus.emit(SUBSCRIPTION_CANCELED_EVENT, {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    });
  }

  public async syncPeriodFromProvider(
    provider: string,
    subscriptionRef: string,
    periodEndsAt: Date,
  ): Promise<void> {
    const subscription: SubscriptionInterface | null = await this.findByRefOrWarn(
      provider,
      subscriptionRef,
      'syncPeriodFromProvider',
    );

    if (!subscription) return;

    // Same terminal guard as cancel(), and for a sharper reason: providers
    // deliver out of order, so a SUBSCRIPTION_UPDATED emitted before a
    // cancellation can arrive after it. Without this, that late event pushes
    // currentPeriodEndsAt forward on an already CANCELED or EXPIRED row and
    // hands back paid access nobody is paying for — and nothing downstream
    // corrects it, because the expiry sweep only looks at rows still ACTIVE.
    if (this.isTerminal(subscription.status)) {
      this.logger.debug(
        `syncPeriodFromProvider no-op — status is ${subscription.status}: ${subscription.id}`,
      );

      return;
    }

    await this.subscriptionRepository.updatePeriodEnd(subscription.id, periodEndsAt);
  }

  public async expireOverdue(): Promise<void> {
    const cutoff: Date = new Date(Date.now() - EXPIRY_GRACE_PERIOD_MS);
    const overdue: SubscriptionInterface[] = await this.subscriptionRepository.findOverdue(
      cutoff,
      EXPIRY_SWEEP_BATCH_LIMIT,
    );

    for (const subscription of overdue) await this.expireOne(subscription);

    this.logger.log(`Expiry sweep complete: ${overdue.length} subscription(s) expired`);
  }

  private async expireOne(subscription: SubscriptionInterface): Promise<void> {
    await this.subscriptionRepository.updateStatus(subscription.id, SubscriptionStatusEnum.EXPIRED);

    this.eventBus.emit(SUBSCRIPTION_EXPIRED_EVENT, {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    });
  }

  private isTerminal(status: SubscriptionStatusEnum): boolean {
    return status === SubscriptionStatusEnum.CANCELED || status === SubscriptionStatusEnum.EXPIRED;
  }

  private async findByRefOrWarn(
    provider: string,
    subscriptionRef: string,
    context: string,
  ): Promise<SubscriptionInterface | null> {
    const subscription: SubscriptionInterface | null =
      await this.subscriptionRepository.findByProviderRef(provider, subscriptionRef);

    if (!subscription) {
      this.logger.warn(`${context}: no local subscription for ${provider}/${subscriptionRef}`);
    }

    return subscription;
  }

  private addDays(date: Date, days: number): Date {
    const result: Date = new Date(date);
    result.setDate(result.getDate() + days);

    return result;
  }
}
