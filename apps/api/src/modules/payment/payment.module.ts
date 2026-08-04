import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_LIFECYCLE,
  SUBSCRIPTION_REPOSITORY,
  WEBHOOK_EVENT_REPOSITORY,
} from '@modules/payment/constants/payment.constants.js';
import { BillingController } from '@modules/payment/controllers/billing.controller.js';
import { WebhookController } from '@modules/payment/controllers/webhook.controller.js';
import { PlanPrismaRepository } from '@modules/payment/repositories/plan-prisma.repository.js';
import { SubscriptionPrismaRepository } from '@modules/payment/repositories/subscription-prisma.repository.js';
import { WebhookEventPrismaRepository } from '@modules/payment/repositories/webhook-event-prisma.repository.js';
import { BillingService } from '@modules/payment/services/billing.service.js';
import { NoopSubscriptionLifecycleService } from '@modules/payment/services/noop-subscription-lifecycle.service.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PaymentWebhookConsumerService } from '@modules/payment/services/payment-webhook-consumer.service.js';
import { WebhookEventDispatcherService } from '@modules/payment/services/webhook-event-dispatcher.service.js';
import { WebhookIngestService } from '@modules/payment/services/webhook-ingest.service.js';
import { Global, Module } from '@nestjs/common';

// Global so provider modules (Stripe in PR 4, others later) can inject
// PaymentProviderRegistryService with a single import line in AppModule —
// mirrors OauthModule.
@Global()
@Module({
  controllers: [BillingController, WebhookController],
  providers: [
    PaymentProviderRegistryService,
    BillingService,
    WebhookIngestService,
    WebhookEventDispatcherService,
    PaymentWebhookConsumerService,
    { provide: PLAN_REPOSITORY, useClass: PlanPrismaRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: SubscriptionPrismaRepository },
    { provide: WEBHOOK_EVENT_REPOSITORY, useClass: WebhookEventPrismaRepository },
    // PR 7 replaces this binding with the real SubscriptionLifecycleService.
    { provide: SUBSCRIPTION_LIFECYCLE, useClass: NoopSubscriptionLifecycleService },
  ],
  exports: [PaymentProviderRegistryService, BillingService],
})
export class PaymentModule {}
