import type { PaymentConfig } from '@configs/payment.config.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { WebhookIngestService } from '@modules/payment/services/webhook-ingest.service.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import { describe, expect, it, vi } from 'vitest';

const payment: PaymentConfig = {
  webhookQueueUrl: 'https://sqs.local/queue/payment-webhooks',
  consumerEnabled: true,
};

const providerEvent: ProviderEventInterface = {
  providerEventId: 'evt_123',
  type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
};

const webhookEvent: WebhookEventInterface = {
  id: '01890a5d-0000-774b-bcce-b302099b0001',
  provider: 'STRIPE',
  providerEventId: 'evt_123',
  type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
  payload: { providerEventId: 'evt_123', type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED },
  status: WebhookEventStatusEnum.RECEIVED,
  attempts: 0,
  lastError: null,
  createdAt: new Date('2026-08-04T00:00:00Z'),
  processedAt: null,
};

function fakeProvider(overrides: Partial<PaymentProviderInterface> = {}): PaymentProviderInterface {
  return {
    name: 'STRIPE',
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    verifyAndParseWebhook: vi.fn().mockResolvedValue(providerEvent),
    ...overrides,
  };
}

interface TestSetupInterface {
  readonly service: WebhookIngestService;
  readonly webhookEventRepository: WebhookEventRepositoryInterface;
  readonly sqsProvider: SqsProviderInterface;
  readonly registry: PaymentProviderRegistryService;
}

function createService(
  options: {
    provider?: PaymentProviderInterface | null;
    upsertResult?: UpsertWebhookEventResultInterface;
  } = {},
): TestSetupInterface {
  const webhookEventRepository: WebhookEventRepositoryInterface = {
    upsertReceived: vi
      .fn()
      .mockResolvedValue(options.upsertResult ?? { event: webhookEvent, isNew: true }),
    findById: vi.fn(),
    markProcessed: vi.fn(),
    markSkipped: vi.fn(),
    markFailed: vi.fn(),
    recordFailure: vi.fn(),
  };
  const sqsProvider: SqsProviderInterface = {
    sendMessage: vi.fn().mockResolvedValue('message-id'),
    receiveMessages: vi.fn(),
    deleteMessage: vi.fn(),
  };
  const registry: PaymentProviderRegistryService = new PaymentProviderRegistryService();

  if (options.provider !== null) {
    registry.register(options.provider ?? fakeProvider());
  }

  const service: WebhookIngestService = new WebhookIngestService(
    webhookEventRepository,
    sqsProvider,
    payment,
    registry,
  );

  return { service, webhookEventRepository, sqsProvider, registry };
}

describe('WebhookIngestService.ingest', () => {
  it('verifies, upserts, and enqueues a new event', async () => {
    const provider = fakeProvider();
    const { service, webhookEventRepository, sqsProvider } = createService({ provider });

    await service.ingest('stripe', Buffer.from('raw'), 'sig_valid');

    expect(provider.verifyAndParseWebhook).toHaveBeenCalledWith(Buffer.from('raw'), 'sig_valid');
    expect(webhookEventRepository.upsertReceived).toHaveBeenCalledWith(
      'STRIPE',
      providerEvent.providerEventId,
      providerEvent.type,
      providerEvent,
    );
    expect(sqsProvider.sendMessage).toHaveBeenCalledWith(payment.webhookQueueUrl, {
      webhookEventId: webhookEvent.id,
    });
  });

  it('resolves the provider case-insensitively via the route param', async () => {
    const provider = fakeProvider();
    const { service } = createService({ provider });

    await service.ingest('StRiPe', Buffer.from('raw'), 'sig_valid');

    expect(provider.verifyAndParseWebhook).toHaveBeenCalled();
  });

  it('skips enqueueing a duplicate delivery', async () => {
    const provider = fakeProvider();
    const { service, sqsProvider } = createService({
      provider,
      upsertResult: { event: webhookEvent, isNew: false },
    });

    await service.ingest('stripe', Buffer.from('raw'), 'sig_valid');

    expect(sqsProvider.sendMessage).not.toHaveBeenCalled();
  });

  it('throws PAYMENT_PROVIDER_NOT_FOUND for an unregistered provider', async () => {
    const { service } = createService({ provider: null });

    const caught: unknown = await service
      .ingest('stripe', Buffer.from('raw'), 'sig_valid')
      .catch((error: unknown): unknown => error);

    expect(caught).toBeInstanceOf(NotFoundError);
    expect((caught as NotFoundError).args.code).toBe('PAYMENT_PROVIDER_NOT_FOUND');
  });

  it('swallows an enqueue failure instead of throwing', async () => {
    const provider = fakeProvider();
    const { service, sqsProvider } = createService({ provider });

    (sqsProvider.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('SQS unavailable'),
    );

    await expect(
      service.ingest('stripe', Buffer.from('raw'), 'sig_valid'),
    ).resolves.toBeUndefined();
  });
});
