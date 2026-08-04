import {
  PLAN_REPOSITORY,
  SUBSCRIPTION_REPOSITORY,
} from '@modules/payment/constants/payment.constants.js';
import { BillingController } from '@modules/payment/controllers/billing.controller.js';
import { PlanPrismaRepository } from '@modules/payment/repositories/plan-prisma.repository.js';
import { SubscriptionPrismaRepository } from '@modules/payment/repositories/subscription-prisma.repository.js';
import { BillingService } from '@modules/payment/services/billing.service.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { Global, Module } from '@nestjs/common';

// Global so provider modules (Stripe in PR 4, others later) can inject
// PaymentProviderRegistryService with a single import line in AppModule —
// mirrors OauthModule.
@Global()
@Module({
  controllers: [BillingController],
  providers: [
    PaymentProviderRegistryService,
    BillingService,
    { provide: PLAN_REPOSITORY, useClass: PlanPrismaRepository },
    { provide: SUBSCRIPTION_REPOSITORY, useClass: SubscriptionPrismaRepository },
  ],
  exports: [PaymentProviderRegistryService, BillingService],
})
export class PaymentModule {}
