import { type PaymentConfig, paymentConfig } from '@configs/payment.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { WEBHOOK_EVENT_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import {
  WEBHOOK_RETRY_BATCH_LIMIT,
  WEBHOOK_RETRY_MAX_ATTEMPTS,
  WEBHOOK_RETRY_STALE_MS,
} from '@modules/payment/constants/webhook-retry.constants.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import type { WebhookRetrySweepResultInterface } from '@modules/payment/interfaces/webhook-retry-sweep-result.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';

@Injectable()
export class WebhookRetryService {
  private readonly logger = new CustomLoggerService(WebhookRetryService.name);

  constructor(
    @Inject(WEBHOOK_EVENT_REPOSITORY)
    private readonly webhookEventRepository: WebhookEventRepositoryInterface,
    @Inject(SQS_PROVIDER)
    private readonly sqsProvider: SqsProviderInterface,
    @Inject(paymentConfig.KEY)
    private readonly payment: PaymentConfig,
  ) {}

  // Two independent sweeps sharing one staleness cutoff: FAILED events under
  // the retry ceiling (the brief's core ask), and stale RECEIVED events
  // whose ingest-time enqueue never reached SQS (the PR 5 TODO in
  // WebhookIngestService.enqueue — a swallowed send failure otherwise leaves
  // the row invisible to reprocessing forever). Order matters: the stale
  // RECEIVED sweep must run BEFORE the FAILED retry, because retryFailed
  // resets rows to RECEIVED without touching createdAt — running it first
  // would make retryStaleReceived re-select and re-enqueue those same rows
  // a second time within the same sweep.
  public async sweep(): Promise<WebhookRetrySweepResultInterface> {
    const cutoff: Date = new Date(Date.now() - WEBHOOK_RETRY_STALE_MS);
    const staleReceivedRetriedCount: number = await this.retryStaleReceived(cutoff);
    const failedRetriedCount: number = await this.retryFailed(cutoff);

    this.logger.log(
      `Webhook retry sweep: failedRetried=${failedRetriedCount} ` +
        `staleReceivedRetried=${staleReceivedRetriedCount}`,
    );

    return { failedRetriedCount, staleReceivedRetriedCount };
  }

  // Resets status to RECEIVED before re-enqueueing so the consumer's level-2
  // short-circuit no longer treats the row as terminal. attempts persists
  // across the reset — a row already at the consumer's own ceiling
  // (MAX_WEBHOOK_ATTEMPTS) fails and re-hits FAILED on its very next dispatch
  // attempt; this job's own higher ceiling (WEBHOOK_RETRY_MAX_ATTEMPTS)
  // bounds how many such passes are attempted before giving up for good.
  private async retryFailed(cutoff: Date): Promise<number> {
    const events: WebhookEventInterface[] = await this.webhookEventRepository.findRetryableFailed(
      cutoff,
      WEBHOOK_RETRY_MAX_ATTEMPTS,
      WEBHOOK_RETRY_BATCH_LIMIT,
    );

    for (const event of events) {
      await this.webhookEventRepository.markRetryQueued(event.id);
      await this.enqueue(event.id);
    }

    return events.length;
  }

  // Already RECEIVED, so no status transition is needed — just re-enqueue.
  // If a message for the row IS still in flight somewhere (the original
  // enqueue actually succeeded, but the row looked stale for some other
  // reason), the consumer processes it twice; idempotency levels 2/3 (status
  // short-circuit + per-event Redis lock) absorb the duplicate delivery
  // harmlessly.
  private async retryStaleReceived(cutoff: Date): Promise<number> {
    const events: WebhookEventInterface[] = await this.webhookEventRepository.findStaleReceived(
      cutoff,
      WEBHOOK_RETRY_BATCH_LIMIT,
    );

    for (const event of events) {
      await this.enqueue(event.id);
    }

    return events.length;
  }

  // Mirrors WebhookIngestService.enqueue: never throws, so one bad SQS call
  // never aborts the rest of the sweep — the row stays a candidate for the
  // next run.
  private async enqueue(webhookEventId: string): Promise<void> {
    try {
      await this.sqsProvider.sendMessage(this.payment.webhookQueueUrl, { webhookEventId });
    } catch (caught) {
      const stack: string | undefined = caught instanceof Error ? caught.stack : undefined;

      this.logger.error(`Failed to re-enqueue webhook event ${webhookEventId}`, stack);
    }
  }
}
