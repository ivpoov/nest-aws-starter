import { type PaymentConfig, paymentConfig } from '@configs/payment.config.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { WEBHOOK_EVENT_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import { PAYMENT_PROVIDER_NOT_FOUND } from '@modules/payment/constants/payment-errors.constants.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { Inject, Injectable } from '@nestjs/common';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';

@Injectable()
export class WebhookIngestService {
  private readonly logger = new CustomLoggerService(WebhookIngestService.name);

  constructor(
    @Inject(WEBHOOK_EVENT_REPOSITORY)
    private readonly webhookEventRepository: WebhookEventRepositoryInterface,
    @Inject(SQS_PROVIDER)
    private readonly sqsProvider: SqsProviderInterface,
    @Inject(paymentConfig.KEY)
    private readonly payment: PaymentConfig,
    private readonly registry: PaymentProviderRegistryService,
  ) {}

  // 1. verify  2. upsert (idempotency level 1 — duplicates never re-enqueue)
  // 3. enqueue  4. return — the controller always turns this into a 200,
  // even when enqueue fails, so Stripe never sees a retry-worthy status.
  public async ingest(providerName: string, rawBody: Buffer, signature: string): Promise<void> {
    const provider: PaymentProviderInterface = this.resolveProviderOrThrow(providerName);
    const event: ProviderEventInterface = await provider.verifyAndParseWebhook(rawBody, signature);

    const result: UpsertWebhookEventResultInterface =
      await this.webhookEventRepository.upsertReceived(
        provider.name,
        event.providerEventId,
        event.type,
        event,
      );

    if (!result.isNew) {
      this.logger.log(`Duplicate webhook event skipped: ${result.event.id}`);

      return;
    }

    await this.enqueue(result.event.id);
  }

  private resolveProviderOrThrow(providerName: string): PaymentProviderInterface {
    const provider: PaymentProviderInterface | null = this.registry.get(providerName.toUpperCase());

    if (!provider) throw new NotFoundError(PAYMENT_PROVIDER_NOT_FOUND);

    return provider;
  }

  // Never fails the request — the event row is already durably persisted as
  // RECEIVED, so acking is safe. A RECEIVED row with no queue message would
  // otherwise be invisible to reprocessing forever — WebhookRetryService
  // (Task 12) sweeps rows still RECEIVED after an hour and re-enqueues them.
  private async enqueue(webhookEventId: string): Promise<void> {
    try {
      await this.sqsProvider.sendMessage(this.payment.webhookQueueUrl, { webhookEventId });
    } catch (caught) {
      const stack: string | undefined = caught instanceof Error ? caught.stack : undefined;

      this.logger.error(`Failed to enqueue webhook event ${webhookEventId}`, stack);
    }
  }
}
