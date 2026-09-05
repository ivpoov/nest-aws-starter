import {
  RETENTION_CRON_EXPRESSION,
  RETENTION_LOCK_TTL_MS,
} from '@modules/common/constants/retention.constants.js';
import type { WebhookRetryService } from '@modules/payment/services/webhook-retry.service.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';

// Not a Nest provider — constructed by the module's registration factory, the
// same idiom as OrphanFileSweepJob and SubscriptionExpiryJob. Nightly, because
// retention is measured in days and an hourly sweep would be busywork that
// still deletes nothing on most runs.
export class WebhookEventRetentionJob implements ScheduledJobInterface {
  public readonly name: string = 'webhook-event-retention';
  public readonly cronExpression: string = RETENTION_CRON_EXPRESSION;
  public readonly lockTtlMs: number = RETENTION_LOCK_TTL_MS;

  constructor(private readonly service: WebhookRetryService) {}

  public async run(): Promise<void> {
    await this.service.purgeExpiredEvents();
  }
}
