import { createHash, randomUUID } from 'node:crypto';
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

// Captured by the fake provider on every call — the raw-bytes e2e case below
// reads it to prove request.rawBody reached verifyAndParseWebhook untouched,
// not a reconstruction (see that test's comment for why this matters).
let lastRawBodySha256: string | undefined;

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
    lastRawBodySha256 = createHash('sha256').update(rawBody).digest('hex');

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

  async function findMessageFor(
    webhookEventId: string,
  ): Promise<SqsMessageInterface | null | undefined> {
    return waitForActivity(async () => {
      const messages: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

      return messages.find(
        (message: SqsMessageInterface): boolean =>
          (JSON.parse(message.body) as { webhookEventId?: string }).webhookEventId ===
          webhookEventId,
      );
    });
  }

  // Proves the raw-body pipe end to end, not just that JSON round-trips.
  // supertest's .send(object) would serialize deterministically either way
  // (real Fastify rawBody vs. a bug reconstructing it via
  // JSON.stringify(request.body)), so a fixture built from a plain object
  // can't distinguish a byte-identical pipe from a "re-stringified but
  // semantically equal" one. This fixture is deliberately hostile to that
  // reconstruction: numeric-string keys out of ascending order get pulled to
  // the front by JS's integer-key enumeration rule, and the stray whitespace
  // is collapsed — so JSON.stringify(JSON.parse(raw)) never equals raw. If
  // request.rawBody ever regressed to a reconstruction, the provider's
  // received bytes would hash differently from what was actually sent.
  it('delivers the exact raw bytes to the provider', async () => {
    const providerEventId = `evt_e2e_raw_${randomUUID()}`;
    const rawFixture =
      `{"2": "c",  "1":"b",\n"providerEventId":"${providerEventId}",` +
      `"type":  "CHECKOUT_COMPLETED", "0":"a"}`;

    expect(JSON.stringify(JSON.parse(rawFixture))).not.toBe(rawFixture);

    const expectedSha256: string = createHash('sha256').update(rawFixture, 'utf-8').digest('hex');

    lastRawBodySha256 = undefined;

    await request(app.getHttpServer())
      .post('/api/v1/webhooks/stripe')
      .set('content-type', 'application/json')
      .set('stripe-signature', VALID_SIGNATURE)
      .send(rawFixture)
      .expect(200);

    expect(lastRawBodySha256).toBe(expectedSha256);
  });

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

    const message: SqsMessageInterface | null | undefined = await findMessageFor(rows[0]?.id ?? '');

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
