import type { PaymentConfig } from '@configs/payment.config.js';
import { MAX_WEBHOOK_ATTEMPTS } from '@modules/payment/constants/webhook-consumer.constants.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { PaymentWebhookConsumerService } from '@modules/payment/services/payment-webhook-consumer.service.js';
import { WebhookEventDispatcherService } from '@modules/payment/services/webhook-event-dispatcher.service.js';
import type { RedisLockService } from '@providers/redis/services/redis-lock.service.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import { describe, expect, it, vi } from 'vitest';

const payment: PaymentConfig = {
  webhookQueueUrl: 'https://sqs.local/queue/payment-webhooks',
  consumerEnabled: true,
};

function baseEvent(overrides: Partial<WebhookEventInterface> = {}): WebhookEventInterface {
  return {
    id: '01890a5d-0000-774b-bcce-b302099e0001',
    provider: 'STRIPE',
    providerEventId: 'evt_123',
    type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
    payload: {},
    status: WebhookEventStatusEnum.RECEIVED,
    attempts: 0,
    lastError: null,
    createdAt: new Date('2026-08-04T00:00:00Z'),
    processedAt: null,
    ...overrides,
  };
}

function message(overrides: Partial<SqsMessageInterface> = {}): SqsMessageInterface {
  return {
    messageId: 'msg-1',
    receiptHandle: 'receipt-1',
    body: JSON.stringify({ webhookEventId: baseEvent().id }),
    ...overrides,
  };
}

interface TestSetupInterface {
  readonly service: PaymentWebhookConsumerService;
  readonly webhookEventRepository: WebhookEventRepositoryInterface;
  readonly sqsProvider: SqsProviderInterface;
  readonly redisLock: { withLock: ReturnType<typeof vi.fn> };
  readonly dispatcher: { dispatch: ReturnType<typeof vi.fn> };
}

function createService(
  options: { event?: WebhookEventInterface | null; lockAcquired?: boolean } = {},
): TestSetupInterface {
  const event: WebhookEventInterface | null =
    options.event === undefined ? baseEvent() : options.event;

  const webhookEventRepository: WebhookEventRepositoryInterface = {
    upsertReceived: vi.fn(),
    findById: vi.fn().mockResolvedValue(event),
    markProcessed: vi.fn().mockResolvedValue(undefined),
    markSkipped: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    recordFailure: vi.fn().mockResolvedValue(1),
  };
  const sqsProvider: SqsProviderInterface = {
    sendMessage: vi.fn(),
    receiveMessages: vi.fn(),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
  };
  const lockAcquired: boolean = options.lockAcquired ?? true;
  const redisLock = {
    withLock: vi.fn(
      async (_name: string, _ttl: number, fn: () => Promise<boolean>): Promise<boolean | null> =>
        lockAcquired ? fn() : null,
    ),
  };
  const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };

  const service: PaymentWebhookConsumerService = new PaymentWebhookConsumerService(
    webhookEventRepository,
    sqsProvider,
    redisLock as unknown as RedisLockService,
    dispatcher as unknown as WebhookEventDispatcherService,
    payment,
  );

  return { service, webhookEventRepository, sqsProvider, redisLock, dispatcher };
}

describe('PaymentWebhookConsumerService.processMessage', () => {
  it('short-circuits an already PROCESSED event: no lock, no dispatch, message deleted', async () => {
    const { service, webhookEventRepository, sqsProvider, redisLock, dispatcher } = createService({
      event: baseEvent({ status: WebhookEventStatusEnum.PROCESSED }),
    });

    await service.processMessage(message());

    expect(redisLock.withLock).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(webhookEventRepository.markProcessed).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).toHaveBeenCalledWith(payment.webhookQueueUrl, 'receipt-1');
  });

  it('short-circuits an already SKIPPED event the same way', async () => {
    const { service, sqsProvider, dispatcher } = createService({
      event: baseEvent({ status: WebhookEventStatusEnum.SKIPPED }),
    });

    await service.processMessage(message());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });

  it('does not delete the message when the lock is held elsewhere', async () => {
    const { service, sqsProvider, dispatcher } = createService({ lockAcquired: false });

    await service.processMessage(message());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).not.toHaveBeenCalled();
  });

  it('marks UNHANDLED events SKIPPED and deletes the message without dispatching', async () => {
    const { service, webhookEventRepository, sqsProvider, dispatcher } = createService({
      event: baseEvent({ type: NormalizedEventTypeEnum.UNHANDLED }),
    });

    await service.processMessage(message());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(webhookEventRepository.markSkipped).toHaveBeenCalledWith(baseEvent().id);
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });

  it('dispatches, marks PROCESSED, and deletes the message on success', async () => {
    const { service, webhookEventRepository, sqsProvider, dispatcher } = createService();

    await service.processMessage(message());

    expect(dispatcher.dispatch).toHaveBeenCalledWith(baseEvent());
    expect(webhookEventRepository.markProcessed).toHaveBeenCalledWith(baseEvent().id);
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });

  it('drops an unparseable message without touching the repository', async () => {
    const { service, webhookEventRepository, sqsProvider } = createService();

    await service.processMessage(message({ body: 'not-json' }));

    expect(webhookEventRepository.findById).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });

  it('records a failure and leaves the message for redelivery below the attempt ceiling', async () => {
    const { service, webhookEventRepository, sqsProvider, dispatcher } = createService();

    dispatcher.dispatch.mockRejectedValue(new Error('provider unreachable'));
    (webhookEventRepository.recordFailure as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await service.processMessage(message());

    expect(webhookEventRepository.recordFailure).toHaveBeenCalledWith(
      baseEvent().id,
      'provider unreachable',
    );
    expect(webhookEventRepository.markFailed).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).not.toHaveBeenCalled();
  });

  it('marks FAILED and deletes the message once attempts reach the ceiling', async () => {
    const { service, webhookEventRepository, sqsProvider, dispatcher } = createService();

    dispatcher.dispatch.mockRejectedValue(new Error('provider unreachable'));
    (webhookEventRepository.recordFailure as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_WEBHOOK_ATTEMPTS,
    );

    await service.processMessage(message());

    expect(webhookEventRepository.markFailed).toHaveBeenCalledWith(baseEvent().id);
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });

  it('drops the message when the event row cannot be found', async () => {
    const { service, sqsProvider, dispatcher } = createService({ event: null });

    await service.processMessage(message());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });
});
