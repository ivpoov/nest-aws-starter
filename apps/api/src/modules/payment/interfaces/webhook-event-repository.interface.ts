import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
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
  // markFailed/recordFailure take the optional unit-of-work handle (§7a): the
  // consumer writes them as one unit, so a row can never end up at the attempt
  // ceiling without the FAILED status that makes the retry sweep see it.
  markFailed(id: string, tx?: TransactionContextInterface): Promise<void>;
  // Pure counter update (attempts++, lastError) — returns the attempts count
  // after the increment. Deciding whether that count crosses the FAILED
  // threshold is a business rule and stays in the consumer service, not
  // here (conventions §1: repositories hold no business logic).
  recordFailure(id: string, error: string, tx?: TransactionContextInterface): Promise<number>;
  // Retry-sweep candidates (WebhookRetryJob): FAILED rows older than cutoff
  // whose attempts haven't hit the retry ceiling yet, oldest first, capped
  // at limit.
  findRetryableFailed(
    cutoff: Date,
    maxAttempts: number,
    limit: number,
  ): Promise<WebhookEventInterface[]>;
  // RECEIVED rows older than cutoff — a row whose ingest-time enqueue never
  // reached SQS (WebhookIngestService.enqueue swallows send failures), oldest
  // first, capped at limit.
  findStaleReceived(cutoff: Date, limit: number): Promise<WebhookEventInterface[]>;
  // Resets a FAILED row back to RECEIVED so the consumer's status
  // short-circuit (level 2) no longer treats it as terminal. attempts is
  // left untouched — the consumer's ceiling check reads it on the next
  // dispatch attempt.
  markRetryQueued(id: string): Promise<void>;
  // Retention, and only for events that reached a terminal state. One still
  // RECEIVED or FAILED is unfinished work or the evidence of a bug — deleting
  // it would destroy the local record of a payment the provider says it sent.
  deleteTerminalOlderThan(cutoff: Date, limit: number): Promise<number>;
}
