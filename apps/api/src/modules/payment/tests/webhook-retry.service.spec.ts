import type { PaymentConfig } from '@configs/payment.config.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { WebhookRetryService } from '@modules/payment/services/webhook-retry.service.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import { describe, expect, it, vi } from 'vitest';

const payment: PaymentConfig = {
  webhookQueueUrl: 'https://sqs.local/queue/payment-webhooks',
  consumerEnabled: true,
};

function makeEvent(overrides: Partial<WebhookEventInterface> = {}): WebhookEventInterface {
  return {
    id: '01890a5d-0000-774b-bcce-b302099e0001',
    provider: 'STRIPE',
    providerEventId: 'evt_123',
    type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
    payload: {},
    status: WebhookEventStatusEnum.FAILED,
    attempts: 5,
    lastError: 'boom',
    createdAt: new Date('2026-08-04T00:00:00Z'),
    processedAt: new Date('2026-08-04T00:05:00Z'),
    ...overrides,
  };
}

interface TestSetupInterface {
  readonly service: WebhookRetryService;
  readonly webhookEventRepository: WebhookEventRepositoryInterface;
  readonly sqsProvider: SqsProviderInterface;
}

function createService(
  options: {
    retryableFailed?: WebhookEventInterface[];
    staleReceived?: WebhookEventInterface[];
  } = {},
): TestSetupInterface {
  const webhookEventRepository: WebhookEventRepositoryInterface = {
    upsertReceived: vi.fn(),
    findById: vi.fn(),
    markProcessed: vi.fn(),
    markSkipped: vi.fn(),
    markFailed: vi.fn(),
    recordFailure: vi.fn(),
    findRetryableFailed: vi.fn().mockResolvedValue(options.retryableFailed ?? []),
    findStaleReceived: vi.fn().mockResolvedValue(options.staleReceived ?? []),
    markRetryQueued: vi.fn(),
  };
  const sqsProvider: SqsProviderInterface = {
    sendMessage: vi.fn().mockResolvedValue('message-id'),
    receiveMessages: vi.fn(),
    deleteMessage: vi.fn(),
  };
  const service: WebhookRetryService = new WebhookRetryService(
    webhookEventRepository,
    sqsProvider,
    payment,
  );

  return { service, webhookEventRepository, sqsProvider };
}

describe('WebhookRetryService.sweep', () => {
  it('queries with the 1h cutoff and the retry-ceiling constant', async () => {
    const { service, webhookEventRepository } = createService();

    await service.sweep();

    const [cutoffArg, maxAttemptsArg, limitArg] = (
      webhookEventRepository.findRetryableFailed as ReturnType<typeof vi.fn>
    ).mock.calls[0] as [Date, number, number];

    expect(Date.now() - cutoffArg.getTime()).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(maxAttemptsArg).toBe(8);
    expect(limitArg).toBe(200);
    expect(webhookEventRepository.findStaleReceived).toHaveBeenCalledWith(expect.any(Date), 200);
  });

  it('re-enqueues each retryable FAILED event and resets it to RECEIVED', async () => {
    const event = makeEvent();
    const { service, webhookEventRepository, sqsProvider } = createService({
      retryableFailed: [event],
    });

    const result = await service.sweep();

    expect(webhookEventRepository.markRetryQueued).toHaveBeenCalledWith(event.id);
    expect(sqsProvider.sendMessage).toHaveBeenCalledWith(payment.webhookQueueUrl, {
      webhookEventId: event.id,
    });
    expect(result.failedRetriedCount).toBe(1);
  });

  it('excludes FAILED events at or over the attempts ceiling (repository contract, verified by call args)', async () => {
    // The ceiling itself is enforced by the repository query (see
    // webhook-event-prisma.repository.spec.ts) — this asserts the service
    // passes the exact ceiling constant through rather than a looser value.
    const { service, webhookEventRepository } = createService();

    await service.sweep();

    expect(webhookEventRepository.findRetryableFailed).toHaveBeenCalledWith(
      expect.any(Date),
      8,
      200,
    );
  });

  it('re-enqueues stale RECEIVED events without changing their status', async () => {
    const event = makeEvent({ status: WebhookEventStatusEnum.RECEIVED, attempts: 0 });
    const { service, webhookEventRepository, sqsProvider } = createService({
      staleReceived: [event],
    });

    const result = await service.sweep();

    expect(webhookEventRepository.markRetryQueued).not.toHaveBeenCalled();
    expect(sqsProvider.sendMessage).toHaveBeenCalledWith(payment.webhookQueueUrl, {
      webhookEventId: event.id,
    });
    expect(result.staleReceivedRetriedCount).toBe(1);
  });

  it('swallows an enqueue failure for one event without aborting the rest of the batch', async () => {
    const first = makeEvent({ id: 'evt-1' });
    const second = makeEvent({ id: 'evt-2' });
    const { service, webhookEventRepository, sqsProvider } = createService({
      retryableFailed: [first, second],
    });

    (sqsProvider.sendMessage as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('SQS unavailable'))
      .mockResolvedValueOnce('message-id');

    const result = await service.sweep();

    expect(webhookEventRepository.markRetryQueued).toHaveBeenCalledWith('evt-1');
    expect(webhookEventRepository.markRetryQueued).toHaveBeenCalledWith('evt-2');
    expect(result.failedRetriedCount).toBe(2);
  });
});
