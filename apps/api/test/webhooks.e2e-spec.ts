import { randomUUID } from 'node:crypto';
import { ValidationError } from '@modules/common/errors/validation.error.js';
import type { PaymentProviderInterface } from '@modules/payment/interfaces/payment-provider.interface.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import { PaymentProviderRegistryService } from '@modules/payment/services/payment-provider-registry.service.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';
import { waitForActivity } from './helpers/wait-for-activity.helper.js';

// Stripe is disabled in this env (STRIPE_ENABLED unset) — the real provider
// never registers, so the fake below is registered under 'STRIPE' with no
// collision. verifyAndParseWebhook decodes the fixture directly (no real
// HMAC) — mirrors billing.e2e-spec.ts's fake-provider pattern rather than
// flipping STRIPE_ENABLED for this file, which would leak into every other
// e2e suite sharing this process (PaymentProviderRegistryService.getDefault()
// picks whichever provider registered first).
const VALID_SIGNATURE = 'valid-signature';
const FAKE_SIGNATURE_INVALID = {
  code: 'FAKE_WEBHOOK_SIGNATURE_INVALID',
  details: 'The webhook signature could not be verified',
};

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
    if (signature !== VALID_SIGNATURE) throw new ValidationError(FAKE_SIGNATURE_INVALID);

    return JSON.parse(rawBody.toString('utf-8')) as ProviderEventInterface;
  },
};

const queueUrl: string =
  process.env.SQS_PAYMENT_WEBHOOK_QUEUE_URL ??
  'http://localhost:4567/000000000000/starter-payment-webhook-queue';

describe('webhooks (fake stripe provider)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let sqs: SqsProviderInterface;

  beforeAll(async () => {
    app = await createTestApp();
    app.get(PaymentProviderRegistryService).register(fakeProvider);
    prisma = app.get(PrismaService);
    sqs = app.get<SqsProviderInterface>(SQS_PROVIDER);
  });

  afterAll(async () => {
    await app.close();
  });

  async function findMessageFor(webhookEventId: string): Promise<SqsMessageInterface | undefined> {
    return waitForActivity(async () => {
      const messages: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

      return messages.find(
        (message: SqsMessageInterface): boolean =>
          (JSON.parse(message.body) as { webhookEventId?: string }).webhookEventId ===
          webhookEventId,
      );
    });
  }

  it('replays the same fixture twice: one row, one queue message', async () => {
    const providerEventId = `evt_e2e_${randomUUID()}`;
    const fixture = { providerEventId, type: 'CHECKOUT_COMPLETED' };

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', VALID_SIGNATURE)
      .send(fixture)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', VALID_SIGNATURE)
      .send(fixture)
      .expect(200);

    const rows = await prisma.webhookEvent.findMany({
      where: { provider: 'STRIPE', providerEventId },
    });

    expect(rows).toHaveLength(1);

    const message: SqsMessageInterface | undefined = await findMessageFor(rows[0]?.id ?? '');

    expect(message).toBeDefined();

    if (message) await sqs.deleteMessage(queueUrl, message.receiptHandle);

    const remaining: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

    expect(
      remaining.some(
        (candidate: SqsMessageInterface): boolean =>
          (JSON.parse(candidate.body) as { webhookEventId?: string }).webhookEventId ===
          rows[0]?.id,
      ),
    ).toBe(false);
  });

  it('rejects a bad signature with the coded 400 envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'wrong-signature')
      .send({ providerEventId: `evt_e2e_${randomUUID()}`, type: 'CHECKOUT_COMPLETED' })
      .expect(400);

    expect(response.body.code).toBe(FAKE_SIGNATURE_INVALID.code);
  });

  it('returns the coded 404 envelope for an unregistered provider', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/webhooks/unknown-provider')
      .send({ providerEventId: `evt_e2e_${randomUUID()}`, type: 'CHECKOUT_COMPLETED' })
      .expect(404);

    expect(response.body.code).toBe('PAYMENT_PROVIDER_NOT_FOUND');
  });
});
