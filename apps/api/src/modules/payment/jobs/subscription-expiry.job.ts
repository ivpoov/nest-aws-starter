import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';

// Not a Nest provider — constructed directly by payment.module.ts's
// registration factory, same idiom as GoogleOauthProvider. Hourly cron;
// SubscriptionLifecycleService.expireOverdue() owns the grace-period math
// (EXPIRY_GRACE_PERIOD_MS).
export class SubscriptionExpiryJob implements ScheduledJobInterface {
  public readonly name: string = 'subscription-expiry';
  public readonly cronExpression: string = '0 * * * *';
  // Generous relative to a sweep over an expected-small overdue set — a
  // crashed holder still self-heals via TTL expiry (10a).
  public readonly lockTtlMs: number = 300_000;

  constructor(private readonly lifecycle: SubscriptionLifecycleInterface) {}

  public async run(): Promise<void> {
    await this.lifecycle.expireOverdue();
  }
}
