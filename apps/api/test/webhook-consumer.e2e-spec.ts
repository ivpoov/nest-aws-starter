import { randomUUID } from 'node:crypto';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { WEBHOOK_EVENT_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import { MAX_WEBHOOK_ATTEMPTS } from '@modules/payment/constants/webhook-consumer.constants.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { PaymentWebhookConsumerService } from '@modules/payment/services/payment-webhook-consumer.service.js';
import { WebhookEventDispatcherService } from '@modules/payment/services/webhook-event-dispatcher.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const queueUrl: string =
  process.env.SQS_PAYMENT_WEBHOOK_QUEUE_URL ??
  'http://localhost:4567/000000000000/starter-payment-webhook-queue';

interface SeededRowInterface {
  readonly id: string;
  readonly providerEventId: string;
}

// Drives PaymentWebhookConsumerService.processMessage() directly rather than
// the app-lifecycle loop (PAYMENT_WEBHOOK_CONSUMER_ENABLED=false in this
// env — see .env / ci.yml) — deterministic, no poll-interval race. Real
// Postgres row + real Redis lock + real LocalStack SQS message throughout;
// only the SubscriptionLifecycleInterface binding is spied on.
describe('webhook consumer (real postgres/redis/localstack, manual drive)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sqs: SqsProviderInterface;
  let consumer: PaymentWebhookConsumerService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sqs = app.get<SqsProviderInterface>(SQS_PROVIDER);
    consumer = app.get(PaymentWebhookConsumerService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedEvent(
    type: NormalizedEventTypeEnum,
    payload: Record<string, unknown> = {},
    status: WebhookEventStatusEnum = WebhookEventStatusEnum.RECEIVED,
  ): Promise<SeededRowInterface> {
    const providerEventId = `evt_consumer_${randomUUID()}`;
    const row = await prisma.webhookEvent.create({
      data: {
        provider: 'STRIPE',
        providerEventId,
        type,
        status,
        payload: JSON.parse(JSON.stringify({ providerEventId, type, ...payload })),
      },
    });

    return { id: row.id, providerEventId };
  }

  async function sendAndReceive(webhookEventId: string): Promise<SqsMessageInterface> {
    await sqs.sendMessage(queueUrl, { webhookEventId });

    const found = await waitForActivity(async () => {
      const messages: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

      return messages.find(
        (candidate: SqsMessageInterface): boolean =>
          (JSON.parse(candidate.body) as { webhookEventId?: string }).webhookEventId ===
          webhookEventId,
      );
    });

    if (!found) throw new Error(`Test setup: no queue message appeared for ${webhookEventId}`);

    return found;
  }

  it('marks an UNHANDLED event SKIPPED and deletes the queue message', async () => {
    const seeded = await seedEvent(NormalizedEventTypeEnum.UNHANDLED);
    const message = await sendAndReceive(seeded.id);

    await consumer.processMessage(message);

    const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: seeded.id } });

    expect(row.status).toBe(WebhookEventStatusEnum.SKIPPED);
    expect(row.processedAt).not.toBeNull();

    const remaining: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

    expect(remaining.some((candidate) => candidate.messageId === message.messageId)).toBe(false);
  });

  it('short-circuits an already-PROCESSED row without dispatching', async () => {
    const seeded = await seedEvent(
      NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
      { checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' } },
      WebhookEventStatusEnum.PROCESSED,
    );
    const message = await sendAndReceive(seeded.id);
    const dispatcher = app.get(WebhookEventDispatcherService);
    const dispatchSpy = vi.spyOn(dispatcher, 'dispatch');

    await consumer.processMessage(message);

    expect(dispatchSpy).not.toHaveBeenCalled();

    const remaining: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

    expect(remaining.some((candidate) => candidate.messageId === message.messageId)).toBe(false);

    dispatchSpy.mockRestore();
  });

  it('increments attempts on failure, marks FAILED, and notifies admins at the 5th', async () => {
    const seeded = await seedEvent(NormalizedEventTypeEnum.CHECKOUT_COMPLETED, {
      checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
    });
    const message = await sendAndReceive(seeded.id);
    const dispatcher = app.get(WebhookEventDispatcherService);
    const dispatchSpy = vi
      .spyOn(dispatcher, 'dispatch')
      .mockRejectedValue(new Error('lifecycle unreachable'));

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await consumer.processMessage(message);

      const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: seeded.id } });

      expect(row.attempts).toBe(attempt);
      expect(row.status).toBe(WebhookEventStatusEnum.RECEIVED);
      expect(row.lastError).toBe('lifecycle unreachable');
    }

    await consumer.processMessage(message);

    const finalRow = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: seeded.id } });

    expect(finalRow.attempts).toBe(5);
    expect(finalRow.status).toBe(WebhookEventStatusEnum.FAILED);

    // <module:notification>
    // The FAILED ceiling emits WEBHOOK_FAILED_EVENT, which the notification
    // module's event subscriber (a separate, subtractable module — see
    // apps/api/src/modules/notification) turns into a single ADMIN-audience
    // row. Proven here rather than in the notification module's own e2e
    // suite because this is the one real emit site for that event.
    const notification = await waitForActivity(() =>
      prisma.notification.findFirst({
        where: { type: 'WEBHOOK_FAILED', meta: { path: ['webhookEventId'], equals: seeded.id } },
      }),
    );

    expect(notification).toMatchObject({
      audience: 'ADMIN',
      userId: null,
      type: 'WEBHOOK_FAILED',
    });
    // </module:notification>

    const remaining: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

    expect(remaining.some((candidate) => candidate.messageId === message.messageId)).toBe(false);

    dispatchSpy.mockRestore();
  });

  // The atomicity proof for the failure-recording path (conventions §7a). The
  // test above proves the attempt counter progresses; it passes with or without
  // a transaction. This one induces a failure BETWEEN the two writes — after the
  // second has really hit Postgres — and asserts the committed row shows
  // neither, which only a real ROLLBACK can satisfy.
  //
  // Without the unit of work, the increment to the ceiling commits while the
  // FAILED status does not: WebhookRetryService.retryFailed selects FAILED rows
  // only, so the row is stranded at the ceiling where no sweep will ever see it.
  it('recordDispatchFailure is atomic: an induced failure leaves the attempt count and status untouched', async () => {
    const seeded = await seedEvent(NormalizedEventTypeEnum.CHECKOUT_COMPLETED, {
      checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
    });
    // One attempt below the ceiling, so this delivery is the one that would
    // cross it and write FAILED.
    await prisma.webhookEvent.update({
      where: { id: seeded.id },
      data: { attempts: MAX_WEBHOOK_ATTEMPTS - 1 },
    });

    const message = await sendAndReceive(seeded.id);
    const dispatcher = app.get(WebhookEventDispatcherService);
    const dispatchSpy = vi
      .spyOn(dispatcher, 'dispatch')
      .mockRejectedValue(new Error('lifecycle unreachable'));
    const repository = app.get<WebhookEventRepositoryInterface>(WEBHOOK_EVENT_REPOSITORY);
    const realMarkFailed = repository.markFailed.bind(repository);
    const markFailedSpy = vi
      .spyOn(repository, 'markFailed')
      .mockImplementation(async (id: string, tx?: TransactionContextInterface): Promise<void> => {
        // Let the status write really happen on the transaction's connection,
        // THEN die — both statements are now pending in the same unit.
        await realMarkFailed(id, tx);

        throw new Error('induced failure mid-transaction');
      });

    await expect(consumer.processMessage(message)).rejects.toThrow(
      'induced failure mid-transaction',
    );

    // Read on the autocommit connection: this is what actually committed.
    const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: seeded.id } });

    expect(row.attempts).toBe(MAX_WEBHOOK_ATTEMPTS - 1);
    expect(row.status).toBe(WebhookEventStatusEnum.RECEIVED);

    markFailedSpy.mockRestore();
    dispatchSpy.mockRestore();
  });

  // Mirrors task-scheduler.e2e-spec.ts's overlap-hold lesson: two real Nest
  // apps against one Redis, both racing PaymentWebhookConsumerService for
  // the SAME event's `webhook:<id>` lock. The dispatch fake holds ~750ms —
  // far longer than any realistic Redis round trip — so both instances'
  // lock acquisition attempts are guaranteed to overlap in wall time instead
  // of running in harmless sequence.
  it('two instances racing the same event dispatch exactly once', async () => {
    const appA: NestFastifyApplication = await createTestApp();
    const appB: NestFastifyApplication = await createTestApp();

    try {
      const seeded = await seedEvent(NormalizedEventTypeEnum.CHECKOUT_COMPLETED, {
        checkoutData: { userId: 'user-1', planId: 'plan-1', customerRef: 'cus_1' },
      });
      const message = await sendAndReceive(seeded.id);
      const redis: RedisClientType = appA.get<RedisClientType>(REDIS_CLIENT);
      const counterKey = `webhook-consumer-e2e:${seeded.id}`;

      const holdAndCount = async (): Promise<void> => {
        await redis.incr(counterKey);
        await sleep(750);
      };

      vi.spyOn(appA.get(WebhookEventDispatcherService), 'dispatch').mockImplementation(
        holdAndCount,
      );
      vi.spyOn(appB.get(WebhookEventDispatcherService), 'dispatch').mockImplementation(
        holdAndCount,
      );

      await Promise.all([
        appA.get(PaymentWebhookConsumerService).processMessage(message),
        appB.get(PaymentWebhookConsumerService).processMessage(message),
      ]);

      const dispatchCount: string | null = await redis.get(counterKey);

      expect(dispatchCount).toBe('1');

      const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: seeded.id } });

      expect(row.status).toBe(WebhookEventStatusEnum.PROCESSED);

      await redis.del(counterKey);
    } finally {
      await appA.close();
      await appB.close();
    }
  });

  // Proves the app-lifecycle wiring itself (OnApplicationBootstrap starts
  // the loop, OnApplicationShutdown stops it and awaits in-flight work) —
  // separate from every other test above, which drives processMessage()
  // directly per this suite's determinism strategy. Own short-lived app so
  // the background loop's brief window of real SQS polling never overlaps
  // another test's queue traffic.
  it('the long-poll loop starts on bootstrap and stops cleanly on shutdown', async () => {
    process.env.PAYMENT_WEBHOOK_CONSUMER_ENABLED = 'true';

    let loopApp: NestFastifyApplication | undefined;

    try {
      loopApp = await createTestApp();
      const loopConsumer = loopApp.get(PaymentWebhookConsumerService);

      expect(loopConsumer.isLoopRunning()).toBe(true);

      await loopApp.close();

      expect(loopConsumer.isLoopRunning()).toBe(false);
      loopApp = undefined;
    } finally {
      process.env.PAYMENT_WEBHOOK_CONSUMER_ENABLED = 'false';
      if (loopApp) await loopApp.close();
    }
  });
});
