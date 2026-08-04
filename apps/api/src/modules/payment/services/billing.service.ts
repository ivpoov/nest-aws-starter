import { type WebAppConfig, webAppConfig } from '@configs/web-app.config.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_LIFECYCLE,
  SUBSCRIPTION_REPOSITORY,
} from '@modules/payment/constants/payment.constants.js';
import {
  PAYMENT_NO_SUBSCRIPTION,
  PAYMENT_PORTAL_UNAVAILABLE,
  PAYMENT_PROVIDER_NOT_ENABLED,
  PLAN_NOT_FOUND,
} from '@modules/payment/constants/payment-errors.constants.js';
import type { CheckoutSessionInterface } from '@modules/payment/interfaces/checkout-session.interface.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { PaymentProviderCancellationInterface } from '@modules/payment/interfaces/payment-provider-cancellation.interface.js';
import type { PlanInterface } from '@modules/payment/interfaces/plan.interface.js';
import type { PlanRepositoryInterface } from '@modules/payment/interfaces/plan-repository.interface.js';
import type { SubscriptionInterface } from '@modules/payment/interfaces/subscription.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { SubscriptionRepositoryInterface } from '@modules/payment/interfaces/subscription-repository.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { Inject, Injectable } from '@nestjs/common';

type ProviderWithCancellationType = PaymentProviderInterface & PaymentProviderCancellationInterface;

@Injectable()
export class BillingService {
  private readonly logger = new CustomLoggerService(BillingService.name);

  constructor(
    @Inject(webAppConfig.KEY)
    private readonly webApp: WebAppConfig,
    @Inject(PLAN_REPOSITORY)
    private readonly planRepository: PlanRepositoryInterface,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepositoryInterface,
    @Inject(SUBSCRIPTION_LIFECYCLE)
    private readonly lifecycle: SubscriptionLifecycleInterface,
    private readonly registry: PaymentProviderRegistryService,
  ) {}

  public listActivePlans(): Promise<PlanInterface[]> {
    return this.planRepository.findManyActive();
  }

  public async createCheckoutSession(
    userId: string,
    planId: string,
  ): Promise<CheckoutSessionInterface> {
    const plan: PlanInterface | null = await this.planRepository.findActiveById(planId);

    if (!plan) throw new NotFoundError(PLAN_NOT_FOUND);

    const provider: PaymentProviderInterface = this.resolveProviderOrThrow();
    const session: CheckoutSessionInterface = await provider.createCheckoutSession({
      userId,
      plan,
    });

    this.logger.log(`Checkout session created: user=${userId} plan=${planId}`);

    return session;
  }

  // The portal return URL is not client-supplied — same trust boundary as the
  // OAuth redirect allowlist, but simpler: there is exactly one valid target,
  // the FE's own billing page, so it's derived from config rather than
  // validated against a list.
  public async createPortalSession(userId: string): Promise<string> {
    const subscription: SubscriptionInterface = await this.findCurrentOrThrow(userId);

    if (!subscription.providerCustomerRef) {
      throw new ValidationError(PAYMENT_PORTAL_UNAVAILABLE);
    }

    const provider: PaymentProviderInterface = this.resolveProviderOrThrow();
    const returnUrl: string = `${this.webApp.baseUrl}/billing`;
    const url: string = await provider.createPortalSession(
      subscription.providerCustomerRef,
      returnUrl,
    );

    this.logger.log(`Portal session created: user=${userId}`);

    return url;
  }

  public async getCurrentSubscription(userId: string): Promise<SubscriptionInterface> {
    return this.findCurrentOrThrow(userId);
  }

  // User-initiated cancel. Reaches the provider first (best-effort — a
  // provider that doesn't implement PaymentProviderCancellationInterface,
  // or isn't registered at all, just gets a local-only cancel) then
  // delegates the actual state transition to SubscriptionLifecycleService,
  // the sole transition owner. Keeps access until currentPeriodEndsAt, same
  // as a webhook-driven cancel.
  public async cancelSubscription(userId: string): Promise<SubscriptionInterface> {
    const subscription: SubscriptionInterface = await this.findCurrentOrThrow(userId);
    // Always set once a subscription exists via checkout activation — see
    // SubscriptionLifecycleService.createSubscriptionFromCheckout.
    const subscriptionRef: string = subscription.providerRef as string;

    await this.cancelWithProviderIfSupported(subscription.provider, subscriptionRef);
    await this.lifecycle.cancel(subscription.provider, subscriptionRef, true);

    this.logger.log(`Subscription cancel requested: user=${userId}`);

    const canceled: SubscriptionInterface | null =
      await this.subscriptionRepository.findByProviderRef(subscription.provider, subscriptionRef);

    return canceled ?? subscription;
  }

  private async cancelWithProviderIfSupported(
    providerName: string,
    subscriptionRef: string,
  ): Promise<void> {
    const provider: PaymentProviderInterface | null = this.registry.get(providerName);

    if (!provider || !this.hasCancellation(provider)) {
      this.logger.warn(
        `Provider ${providerName} has no upstream cancellation support — local-only cancel`,
      );

      return;
    }

    await provider.cancelAtPeriodEnd(subscriptionRef);
  }

  private hasCancellation(
    provider: PaymentProviderInterface,
  ): provider is ProviderWithCancellationType {
    return (
      'cancelAtPeriodEnd' in provider &&
      typeof (provider as Partial<PaymentProviderCancellationInterface>).cancelAtPeriodEnd ===
        'function'
    );
  }

  private async findCurrentOrThrow(userId: string): Promise<SubscriptionInterface> {
    const subscription: SubscriptionInterface | null =
      await this.subscriptionRepository.findCurrentByUserId(userId);

    if (!subscription) throw new NotFoundError(PAYMENT_NO_SUBSCRIPTION);

    return subscription;
  }

  // Single-provider today (registry.getDefault()) — once a second provider
  // ships, checkout/portal will need to pick by provider name instead.
  private resolveProviderOrThrow(): PaymentProviderInterface {
    const provider: PaymentProviderInterface | null = this.registry.getDefault();

    if (!provider) throw new ValidationError(PAYMENT_PROVIDER_NOT_ENABLED);

    return provider;
  }
}
