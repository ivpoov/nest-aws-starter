import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';

export interface WebhookEventRepositoryInterface {
  // Idempotency backbone: (provider, providerEventId) is unique — a replayed
  // delivery upserts onto the same row instead of erroring, and isNew tells
  // the caller whether to enqueue for processing.
  upsertReceived(
    provider: string,
    providerEventId: string,
    type: string,
    payload: ProviderEventInterface,
  ): Promise<UpsertWebhookEventResultInterface>;
}
