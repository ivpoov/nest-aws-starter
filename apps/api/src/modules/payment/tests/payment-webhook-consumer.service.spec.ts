import type { PaymentConfig } from '@configs/payment.config.js';
import { WEBHOOK_FAILED_EVENT } from '@modules/event/constants/event-names.constants.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
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
  readonly eventBus: { emit: ReturnType<typeof vi.fn> };
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
  const eventBus = { emit: vi.fn() };

  const service: PaymentWebhookConsumerService = new PaymentWebhookConsumerService(
    webhookEventRepository,
    sqsProvider,
    redisLock as unknown as RedisLockService,
    dispatcher as unknown as WebhookEventDispatcherService,
    eventBus as unknown as EventBusService,
    payment,
  );

  return { service, webhookEventRepository, sqsProvider, redisLock, dispatcher, eventBus };
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
    const { service, webhookEventRepository, sqsProvider, dispatcher, eventBus } = createService();

    dispatcher.dispatch.mockRejectedValue(new Error('provider unreachable'));
    (webhookEventRepository.recordFailure as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    await service.processMessage(message());

    expect(webhookEventRepository.recordFailure).toHaveBeenCalledWith(
      baseEvent().id,
      'provider unreachable',
    );
    expect(webhookEventRepository.markFailed).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('marks FAILED, emits WEBHOOK_FAILED_EVENT, and deletes the message once attempts reach the ceiling', async () => {
    const { service, webhookEventRepository, sqsProvider, dispatcher, eventBus } = createService();

    dispatcher.dispatch.mockRejectedValue(new Error('provider unreachable'));
    (webhookEventRepository.recordFailure as ReturnType<typeof vi.fn>).mockResolvedValue(
      MAX_WEBHOOK_ATTEMPTS,
    );

    await service.processMessage(message());

    expect(webhookEventRepository.markFailed).toHaveBeenCalledWith(baseEvent().id);
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
    expect(eventBus.emit).toHaveBeenCalledWith(WEBHOOK_FAILED_EVENT, {
      webhookEventId: baseEvent().id,
      provider: baseEvent().provider,
      type: baseEvent().type,
      attempts: MAX_WEBHOOK_ATTEMPTS,
      lastError: 'provider unreachable',
    });
  });

  it('drops the message when the event row cannot be found', async () => {
    const { service, sqsProvider, dispatcher } = createService({ event: null });

    await service.processMessage(message());

    expect(dispatcher.dispatch).not.toHaveBeenCalled();
    expect(sqsProvider.deleteMessage).toHaveBeenCalled();
  });
});

describe('PaymentWebhookConsumerService.processMessages (loop containment)', () => {
  // Regression for the review finding: an error anywhere in one message's
  // processing (here, sqsProvider.deleteMessage rejecting) must be caught
  // and logged, never escape processMessages — runLoop() is fire-and-forget
  // from onApplicationBootstrap, so an escaped rejection would be a
  // top-level unhandled rejection that kills the process by default.
  it('contains a per-message failure, logs it, and still processes the next message', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };

    process.on('unhandledRejection', onUnhandledRejection);
    const errorSpy = vi.spyOn(CustomLoggerService.prototype, 'error').mockImplementation(() => {});

    try {
      const eventA = baseEvent({ id: 'evt-a', status: WebhookEventStatusEnum.PROCESSED });
      const eventB = baseEvent({ id: 'evt-b', status: WebhookEventStatusEnum.PROCESSED });
      const webhookEventRepository: WebhookEventRepositoryInterface = {
        upsertReceived: vi.fn(),
        findById: vi.fn(async (id: string) => (id === 'evt-a' ? eventA : eventB)),
        markProcessed: vi.fn(),
        markSkipped: vi.fn(),
        markFailed: vi.fn(),
        recordFailure: vi.fn(),
      };
      const sqsProvider: SqsProviderInterface = {
        sendMessage: vi.fn(),
        receiveMessages: vi.fn(),
        deleteMessage: vi.fn(async (_url: string, receiptHandle: string): Promise<void> => {
          if (receiptHandle === 'receipt-a') throw new Error('sqs delete failed');
        }),
      };
      const redisLock = { withLock: vi.fn() };
      const dispatcher = { dispatch: vi.fn() };
      const eventBus = { emit: vi.fn() };
      const service: PaymentWebhookConsumerService = new PaymentWebhookConsumerService(
        webhookEventRepository,
        sqsProvider,
        redisLock as unknown as RedisLockService,
        dispatcher as unknown as WebhookEventDispatcherService,
        eventBus as unknown as EventBusService,
        payment,
      );
      const messageA = message({
        messageId: 'msg-a',
        receiptHandle: 'receipt-a',
        body: JSON.stringify({ webhookEventId: 'evt-a' }),
      });
      const messageB = message({
        messageId: 'msg-b',
        receiptHandle: 'receipt-b',
        body: JSON.stringify({ webhookEventId: 'evt-b' }),
      });

      await expect(service.processMessages([messageA, messageB])).resolves.toBeUndefined();

      // Let any stray microtask-queued rejection surface before asserting.
      await new Promise((resolve) => setImmediate(resolve));

      expect(sqsProvider.deleteMessage).toHaveBeenCalledWith(payment.webhookQueueUrl, 'receipt-a');
      expect(sqsProvider.deleteMessage).toHaveBeenCalledWith(payment.webhookQueueUrl, 'receipt-b');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook message processing failed, left for redelivery: msg-a'),
        expect.anything(),
      );
      expect(unhandledRejections).toHaveLength(0);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
      errorSpy.mockRestore();
    }
  });
});
