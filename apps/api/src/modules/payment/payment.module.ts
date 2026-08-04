import {
  PAYMENT_TRANSACTION_REPOSITORY,
  PLAN_REPOSITORY,
  SUBSCRIPTION_LIFECYCLE,
  SUBSCRIPTION_REPOSITORY,
  WEBHOOK_EVENT_REPOSITORY,
} from '@modules/payment/constants/payment.constants.js';
import { BillingController } from '@modules/payment/controllers/billing.controller.js';
import { WebhookController } from '@modules/payment/controllers/webhook.controller.js';
import { RequiresSubscriptionGuard } from '@modules/payment/guards/requires-subscription.guard.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import { SubscriptionExpiryJob } from '@modules/payment/jobs/subscription-expiry.job.js';
import { PaymentTransactionPrismaRepository } from '@modules/payment/repositories/payment-transaction-prisma.repository.js';
import { PlanPrismaRepository } from '@modules/payment/repositories/plan-prisma.repository.js';
import { SubscriptionPrismaRepository } from '@modules/payment/repositories/subscription-prisma.repository.js';
import { WebhookEventPrismaRepository } from '@modules/payment/repositories/webhook-event-prisma.repository.js';
import { BillingService } from '@modules/payment/services/billing.service.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PaymentWebhookConsumerService } from '@modules/payment/services/payment-webhook-consumer.service.js';
import { SubscriptionService } from '@modules/payment/services/subscription.service.js';
import { SubscriptionLifecycleService } from '@modules/payment/services/subscription-lifecycle.service.js';
import { WebhookEventDispatcherService } from '@modules/payment/services/webhook-event-dispatcher.service.js';
import { WebhookIngestService } from '@modules/payment/services/webhook-ingest.service.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { Global, Module, type Provider } from '@nestjs/common';

// Same self-registration idiom as the oauth-* provider modules
// (registry.register() from a factory provider) — TaskSchedulerModule is
// @Global(), so ScheduledJobRegistryService is already resolvable here.
const scheduledJobRegistrationProvider: Provider = {
  provide: Symbol('SUBSCRIPTION_EXPIRY_JOB_REGISTRATION'),
  inject: [ScheduledJobRegistryService, SUBSCRIPTION_LIFECYCLE],
  useFactory: (
    registry: ScheduledJobRegistryService,
    lifecycle: SubscriptionLifecycleInterface,
  ): boolean => {
    registry.register(new SubscriptionExpiryJob(lifecycle));

    return true;
  },
};

// Global so provider modules (Stripe in PR 4, others later) can inject
// PaymentProviderRegistryService with a single import line in AppModule —
// mirrors OauthModule.
@Global()
@Module({
  controllers: [BillingController, WebhookController],
  providers: [
    PaymentProviderRegistryService,
    BillingService,
    SubscriptionService,
    WebhookIngestService,
    WebhookEventDispatcherService,
    PaymentWebhookConsumerService,
    RequiresSubscriptionGuard,
    { provide: PLAN_REPOSITORY, useClass: PlanPrismaRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: SubscriptionPrismaRepository },
    { provide: WEBHOOK_EVENT_REPOSITORY, useClass: WebhookEventPrismaRepository },
    { provide: PAYMENT_TRANSACTION_REPOSITORY, useClass: PaymentTransactionPrismaRepository },
    { provide: SUBSCRIPTION_LIFECYCLE, useClass: SubscriptionLifecycleService },
    scheduledJobRegistrationProvider,
  ],
  exports: [
    PaymentProviderRegistryService,
    BillingService,
    SubscriptionService,
    RequiresSubscriptionGuard,
  ],
})
export class PaymentModule {}
