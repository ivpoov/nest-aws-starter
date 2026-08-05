import { randomUUID } from 'node:crypto';
import { SUBSCRIPTION_LIFECYCLE } from '@modules/payment/constants/payment.constants.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { SubscriptionLifecycleInterface } from '@modules/payment/interfaces/subscription-lifecycle.interface.js';
import { SubscriptionExpiryJob } from '@modules/payment/jobs/subscription-expiry.job.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PaymentWebhookConsumerService } from '@modules/payment/services/payment-webhook-consumer.service.js';
import { SubscriptionService } from '@modules/payment/services/subscription.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

// Full checkout -> renewal -> past_due -> canceled -> expired lifecycle,
// driven through the real pipeline where practical: the fake provider
// mirrors webhooks.e2e-spec.ts, ingestion goes through the real HTTP
// endpoint (WebhookIngestService writes the row + enqueues real SQS), and
// each message is handed to PaymentWebhookConsumerService.processMessage()
// directly (mirrors webhook-consumer.e2e-spec.ts) instead of racing the
// long-poll loop's own interval.
const VALID_SIGNATURE = 'valid-signature';

const fakeProvider: PaymentProviderInterface = {
  name: 'STRIPE',
  createCheckoutSession: async () => {
    throw new Error('not exercised by this suite');
  },
  createPortalSession: async () => {
    throw new Error('not exercised by this suite');
  },
  verifyAndParseWebhook: async (
    rawBody: Buffer,
    signature: string,
  ): Promise<ProviderEventInterface> => {
    if (signature !== VALID_SIGNATURE) throw new Error('bad signature');

    return JSON.parse(rawBody.toString('utf-8')) as ProviderEventInterface;
  },
};

const queueUrl: string =
  process.env.SQS_PAYMENT_WEBHOOK_QUEUE_URL ??
  'http://localhost:4567/000000000000/starter-payment-webhook-queue';

describe('subscription lifecycle (deep e2e, fixture webhooks through the real pipeline)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sqs: SqsProviderInterface;
  let consumer: PaymentWebhookConsumerService;
  let lifecycle: SubscriptionLifecycleInterface;
  let subscriptionService: SubscriptionService;
  let userToken: string;
  let userId: string;
  let planId: string;
  const subscriptionRef: string = `sub_e2e_${randomUUID()}`;

  beforeAll(async () => {
    app = await createTestApp();
    app.get(PaymentProviderRegistryService).register(fakeProvider);
    prisma = app.get(PrismaService);
    sqs = app.get<SqsProviderInterface>(SQS_PROVIDER);
    consumer = app.get(PaymentWebhookConsumerService);
    lifecycle = app.get<SubscriptionLifecycleInterface>(SUBSCRIPTION_LIFECYCLE);
    subscriptionService = app.get(SubscriptionService);

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({
        displayName: 'Lifecycle E2E',
        email: `lifecycle-e2e-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    userToken = registerResponse.body.accessToken;

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('authorization', `Bearer ${userToken}`)
      .expect(200);

    userId = meResponse.body.id;

    const plan = await prisma.plan.create({
      data: {
        name: `Pro ${randomUUID()}`,
        amountCents: 1900,
        currency: 'USD',
        intervalDays: 30,
        providerRefs: { STRIPE: 'price_lifecycle' },
      },
    });

    planId = plan.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function findMessageFor(webhookEventId: string): Promise<SqsMessageInterface> {
    const found = await waitForActivity(async () => {
      const messages: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

      return messages.find(
        (message: SqsMessageInterface): boolean =>
          (JSON.parse(message.body) as { webhookEventId?: string }).webhookEventId ===
          webhookEventId,
      );
    });

    if (!found) throw new Error(`Test setup: no queue message appeared for ${webhookEventId}`);

    return found;
  }

  // Ingests through the real HTTP endpoint, finds the resulting SQS message,
  // and hands it to the consumer's processMessage() directly.
  async function ingestAndProcess(fixture: Record<string, unknown>): Promise<void> {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', VALID_SIGNATURE)
      .send(fixture)
      .expect(200);

    const row = await prisma.webhookEvent.findFirstOrThrow({
      where: { provider: 'STRIPE', providerEventId: fixture.providerEventId as string },
    });
    const message: SqsMessageInterface = await findMessageFor(row.id);

    await consumer.processMessage(message);
  }

  it('checkout: activates the subscription, persists the customer ref, records an activity row', async () => {
    await ingestAndProcess({
      providerEventId: `evt_checkout_${randomUUID()}`,
      type: 'CHECKOUT_COMPLETED',
      subscriptionRef,
      checkoutData: { userId, planId, customerRef: 'cus_e2e_1' },
    });

    const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });

    expect(subscription.status).toBe('ACTIVE');
    expect(subscription.provider).toBe('STRIPE');
    expect(subscription.providerRef).toBe(subscriptionRef);
    expect(subscription.providerCustomerRef).toBe('cus_e2e_1');
    expect(subscription.currentPeriodEndsAt.getTime()).toBeGreaterThan(Date.now());

    const activity = await waitForActivity(() =>
      prisma.activity.findFirst({ where: { userId, type: 'SUBSCRIPTION_ACTIVATED' } }),
    );

    expect(activity).toBeTruthy();
  });

  it('renewal: extends the period, records a transaction, and a replay is a no-op', async () => {
    const before = await prisma.subscription.findFirstOrThrow({ where: { userId } });
    const periodEndsAt = new Date(before.currentPeriodEndsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const transactionData = {
      providerRef: `in_e2e_${randomUUID()}`,
      amountCents: 1900,
      currency: 'USD',
      status: TransactionStatusEnum.SUCCEEDED,
    };

    await ingestAndProcess({
      providerEventId: `evt_renewal_${randomUUID()}`,
      type: 'PAYMENT_SUCCEEDED',
      subscriptionRef,
      periodEndsAt: periodEndsAt.toISOString(),
      transactionData,
    });

    const after = await prisma.subscription.findFirstOrThrow({ where: { userId } });

    expect(after.currentPeriodEndsAt.toISOString()).toBe(periodEndsAt.toISOString());

    const transactions = await prisma.paymentTransaction.findMany({
      where: { subscriptionId: after.id },
    });

    expect(transactions).toHaveLength(1);

    await waitForActivity(() =>
      prisma.activity.findFirst({ where: { userId, type: 'SUBSCRIPTION_RENEWED' } }),
    );

    // Replay: the same provider event dispatched again against the real DB —
    // proves the unique [provider, providerRef] constraint on
    // PaymentTransaction (not a mock) is what makes recordRenewal idempotent.
    await lifecycle.recordRenewal({
      provider: 'STRIPE',
      subscriptionRef,
      periodEndsAt,
      transactionData,
    });

    const replayed = await prisma.subscription.findFirstOrThrow({ where: { userId } });
    const transactionsAfterReplay = await prisma.paymentTransaction.findMany({
      where: { subscriptionId: after.id },
    });
    const renewedActivities = await prisma.activity.findMany({
      where: { userId, type: 'SUBSCRIPTION_RENEWED' },
    });

    expect(transactionsAfterReplay).toHaveLength(1);
    expect(replayed.currentPeriodEndsAt.toISOString()).toBe(periodEndsAt.toISOString());
    expect(renewedActivities).toHaveLength(1);
  });

  it('payment_failed: marks the subscription PAST_DUE', async () => {
    await ingestAndProcess({
      providerEventId: `evt_failed_${randomUUID()}`,
      type: 'PAYMENT_FAILED',
      subscriptionRef,
    });

    const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });

    expect(subscription.status).toBe('PAST_DUE');

    const activity = await waitForActivity(() =>
      prisma.activity.findFirst({ where: { userId, type: 'SUBSCRIPTION_PAST_DUE' } }),
    );

    expect(activity).toBeTruthy();
  });

  it('subscription_updated with cancel hint: cancels but keeps access until period end', async () => {
    await ingestAndProcess({
      providerEventId: `evt_cancel_${randomUUID()}`,
      type: 'SUBSCRIPTION_UPDATED',
      subscriptionRef,
      canceledAtPeriodEnd: true,
    });

    const subscription = await prisma.subscription.findFirstOrThrow({ where: { userId } });

    expect(subscription.status).toBe('CANCELED');
    expect(subscription.canceledAt).not.toBeNull();

    await expect(subscriptionService.hasActiveSubscription(userId)).resolves.toBe(true);

    const activity = await waitForActivity(() =>
      prisma.activity.findFirst({ where: { userId, type: 'SUBSCRIPTION_CANCELED' } }),
    );

    expect(activity).toBeTruthy();
  });

  it('expiry job: expires an overdue subscription but respects the 3-day grace window', async () => {
    const withinGraceRef = `sub_e2e_grace_${randomUUID()}`;
    const pastGraceRef = `sub_e2e_expired_${randomUUID()}`;

    const withinGrace = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        provider: 'STRIPE',
        providerRef: withinGraceRef,
        providerCustomerRef: 'cus_e2e_1',
        currentPeriodEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });
    const pastGrace = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'ACTIVE',
        provider: 'STRIPE',
        providerRef: pastGraceRef,
        providerCustomerRef: 'cus_e2e_1',
        currentPeriodEndsAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      },
    });

    const job = new SubscriptionExpiryJob(lifecycle);

    await job.run();

    const stillActive = await prisma.subscription.findUniqueOrThrow({
      where: { id: withinGrace.id },
    });
    const expired = await prisma.subscription.findUniqueOrThrow({ where: { id: pastGrace.id } });

    expect(stillActive.status).toBe('ACTIVE');
    expect(expired.status).toBe('EXPIRED');

    const activity = await waitForActivity(() =>
      prisma.activity.findFirst({
        where: { userId, type: 'SUBSCRIPTION_EXPIRED' },
      }),
    );

    expect(activity).toBeTruthy();
  });
});
