import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import type { ActivateFromCheckoutDataInterface } from '@modules/payment/interfaces/activate-from-checkout-data.interface.js';
import type { RecordRenewalDataInterface } from '@modules/payment/interfaces/record-renewal-data.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import { Injectable } from '@nestjs/common';

// PR 7 replaces this binding (SUBSCRIPTION_LIFECYCLE token, payment.module.ts)
// with the real SubscriptionLifecycleService. Until then every dispatch
// target logs and returns — the consumer/dispatcher wiring in this PR is
// fully testable without waiting on PR 7's state-transition logic.
@Injectable()
export class NoopSubscriptionLifecycleService implements SubscriptionLifecycleInterface {
  private readonly logger = new CustomLoggerService(NoopSubscriptionLifecycleService.name);

  public async activateFromCheckout(data: ActivateFromCheckoutDataInterface): Promise<void> {
    this.logger.debug(`[noop] activateFromCheckout: ${data.checkoutData.userId}`);
  }

  public async recordRenewal(data: RecordRenewalDataInterface): Promise<void> {
    this.logger.debug(`[noop] recordRenewal: ${data.subscriptionRef}`);
  }

  public async markPastDue(subscriptionRef: string): Promise<void> {
    this.logger.debug(`[noop] markPastDue: ${subscriptionRef}`);
  }

  public async cancel(subscriptionRef: string, canceledAtPeriodEnd: boolean): Promise<void> {
    this.logger.debug(`[noop] cancel: ${subscriptionRef} (atPeriodEnd=${canceledAtPeriodEnd})`);
  }

  public async expireOverdue(): Promise<void> {
    this.logger.debug('[noop] expireOverdue');
  }
}
