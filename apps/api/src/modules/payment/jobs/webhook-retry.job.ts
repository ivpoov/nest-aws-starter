import {
  WEBHOOK_RETRY_CRON_EXPRESSION,
  WEBHOOK_RETRY_LOCK_TTL_MS,
} from '@modules/payment/constants/webhook-retry.constants.js';
import type { WebhookRetryService } from '@modules/payment/services/webhook-retry.service.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';

// Not a Nest provider — constructed directly by payment.module.ts's
// registration factory, same idiom as SubscriptionExpiryJob. Hourly cron;
// WebhookRetryService.sweep() owns both halves: FAILED events under the
// attempts ceiling, and stale RECEIVED rows whose ingest-time enqueue never
// landed (PR 5 TODO in WebhookIngestService.enqueue).
export class WebhookRetryJob implements ScheduledJobInterface {
  public readonly name: string = 'webhook-retry';
  public readonly cronExpression: string = WEBHOOK_RETRY_CRON_EXPRESSION;
  public readonly lockTtlMs: number = WEBHOOK_RETRY_LOCK_TTL_MS;

  constructor(private readonly webhookRetryService: WebhookRetryService) {}

  public async run(): Promise<void> {
    await this.webhookRetryService.sweep();
  }
}
