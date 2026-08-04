import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';

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
  findById(id: string): Promise<WebhookEventInterface | null>;
  markProcessed(id: string): Promise<void>;
  markSkipped(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  // Pure counter update (attempts++, lastError) — returns the attempts count
  // after the increment. Deciding whether that count crosses the FAILED
  // threshold is a business rule and stays in the consumer service, not
  // here (conventions §1: repositories hold no business logic).
  recordFailure(id: string, error: string): Promise<number>;
}
