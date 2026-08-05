import { randomUUID } from 'node:crypto';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js'; // <module:payment>
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js'; // <module:payment>
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { ScheduledJobInterface } from '@modules/task-scheduler/interfaces/scheduled-job.interface.js';
import { ScheduledJobRegistryService } from '@modules/task-scheduler/services/scheduled-job-registry.service.js';
import { FileIntentEnum, FileStatusEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { S3_PROVIDER } from '@providers/s3/constants/s3.constants.js';
import type { S3ProviderInterface } from '@providers/s3/interfaces/s3-provider.interface.js';
// <module:payment>
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';
// </module:payment>
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './app.factory.js';
import { ensureBucket } from './helpers/ensure-bucket.helper.js';

// <module:payment>
const queueUrl: string =
  process.env.SQS_PAYMENT_WEBHOOK_QUEUE_URL ??
  'http://localhost:4567/000000000000/starter-payment-webhook-queue';
// </module:payment>

const ONE_DAY_MS = 25 * 60 * 60 * 1000; // 25h — clears the 24h staleness threshold
// <module:payment>
const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // clears the 1h webhook-retry threshold
// </module:payment>

// Drives OrphanFileSweepJob and WebhookRetryJob directly via the registry
// they self-register with at boot (proves the wiring in file.module.ts /
// payment.module.ts) rather than racing the cron schedule — same
// determinism strategy as webhook-consumer.e2e-spec's processMessage()
// calls and task-scheduler.e2e-spec's runJob() calls.
describe('maintenance jobs (real postgres/redis/localstack)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let s3: S3ProviderInterface;
  let sqs: SqsProviderInterface; // <module:payment>
  let registry: ScheduledJobRegistryService;
  let ownerId: string;

  beforeAll(async () => {
    await ensureBucket();
    app = await createTestApp();
    prisma = app.get(PrismaService);
    s3 = app.get<S3ProviderInterface>(S3_PROVIDER);
    sqs = app.get<SqsProviderInterface>(SQS_PROVIDER); // <module:payment>
    registry = app.get(ScheduledJobRegistryService);
    await neutralizeStaleWebhookEventBacklog(); // <module:payment>
    await drainQueue(); // <module:payment>
    ownerId = await registerUserId();
  });

  afterAll(async () => {
    await app.close();
  });

  // <module:payment>
  // Both jobs' retry sweeps are global by design (every stale row, that's
  // the point of a sweep) against the SAME payment webhook queue that
  // webhook-consumer.e2e-spec / subscription-lifecycle.e2e-spec poll for
  // their own freshly sent messages. A long-lived dev database/queue shared
  // across many e2e runs accumulates real stale rows and never-deleted
  // messages from unrelated earlier sessions — every WebhookRetryJob.run()
  // re-enqueues that entire backlog, and SQS's ReceiveMessage tends to
  // return the oldest visible messages first, so old undeleted noise can
  // permanently crowd out a sibling spec's newer targeted message from ever
  // appearing in a bounded 10-per-call poll. Clear both sides once, up
  // front, using the same plain Prisma/SqsProviderInterface calls every
  // e2e spec already uses — not a fixture any other passing spec depends
  // on (each spec queries/consumes its own freshly created ids or
  // messages), so this only removes noise.
  async function neutralizeStaleWebhookEventBacklog(): Promise<void> {
    const cutoff = new Date(Date.now() - TWO_HOURS_MS);

    await prisma.webhookEvent.updateMany({
      where: { status: WebhookEventStatusEnum.RECEIVED, createdAt: { lt: cutoff } },
      data: { status: WebhookEventStatusEnum.SKIPPED, processedAt: new Date() },
    });
    await prisma.webhookEvent.updateMany({
      where: {
        status: WebhookEventStatusEnum.FAILED,
        createdAt: { lt: cutoff },
        attempts: { lt: 8 },
      },
      data: { attempts: 8 },
    });
  }

  // Drains every currently-visible message from the shared payment webhook
  // queue via the app's own SqsProviderInterface (receive + delete in a
  // loop) — the DB-side neutralization above cannot retroactively clean up
  // messages an earlier, already-run e2e pass already sent to SQS. Stops
  // once two consecutive empty receives confirm nothing is left (accounts
  // for messages that were mid-visibility-timeout during an earlier poll),
  // capped so a misbehaving queue can't hang the suite.
  async function drainQueue(): Promise<void> {
    let consecutiveEmpty = 0;

    for (let iteration = 0; iteration < 200 && consecutiveEmpty < 2; iteration += 1) {
      const messages: SqsMessageInterface[] = await sqs.receiveMessages(queueUrl, 10);

      if (messages.length === 0) {
        consecutiveEmpty += 1;
        continue;
      }

      consecutiveEmpty = 0;
      for (const message of messages) {
        await sqs.deleteMessage(queueUrl, message.receiptHandle);
      }
    }
  }
  // </module:payment>

  async function registerUserId(): Promise<string> {
    const email: string = `maintenance-jobs-e2e-${randomUUID()}@example.com`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', `10.${Math.floor(Math.random() * 255)}.0.1`)
      .send({ displayName: 'Maintenance Jobs E2E', email, password: 'correct-horse-battery' })
      .expect(201);

    const found = await prisma.authMethod.findFirst({ where: { email } });

    return found?.userId ?? '';
  }

  function findJobOrThrow(name: string): ScheduledJobInterface {
    const job: ScheduledJobInterface | undefined = registry
      .getAll()
      .find((candidate: ScheduledJobInterface): boolean => candidate.name === name);

    if (!job) throw new Error(`Test setup: job not registered: ${name}`);

    return job;
  }

  describe('OrphanFileSweepJob', () => {
    it('is registered with the scheduler', () => {
      const job = findJobOrThrow('orphan-file-sweep');

      expect(job.cronExpression).toBe('0 3 * * *');
    });

    it('deletes a stale PENDING row whose S3 object never landed', async () => {
      const staleAbsent = await prisma.file.create({
        data: {
          ownerId,
          intent: FileIntentEnum.ATTACHMENT,
          key: `files/${ownerId}/${randomUUID()}`,
          contentType: 'text/plain',
          size: 0,
          status: FileStatusEnum.PENDING,
          createdAt: new Date(Date.now() - ONE_DAY_MS),
        },
      });

      await findJobOrThrow('orphan-file-sweep').run();

      const row = await prisma.file.findUnique({ where: { id: staleAbsent.id } });

      expect(row).toBeNull();
    });

    it('reconciles a stale PENDING row to READY when the object actually landed in S3 (missed confirm)', async () => {
      const key: string = `files/${ownerId}/${randomUUID()}`;
      const body: string = 'orphan sweep recovered this upload';

      await s3.upload({ key, body: Buffer.from(body), contentType: 'text/plain' });

      const stalePresent = await prisma.file.create({
        data: {
          ownerId,
          intent: FileIntentEnum.ATTACHMENT,
          key,
          contentType: 'text/plain',
          size: 0,
          status: FileStatusEnum.PENDING,
          createdAt: new Date(Date.now() - ONE_DAY_MS),
        },
      });

      await findJobOrThrow('orphan-file-sweep').run();

      const row = await prisma.file.findUniqueOrThrow({ where: { id: stalePresent.id } });

      expect(row.status).toBe(FileStatusEnum.READY);
      expect(row.size).toBe(Buffer.byteLength(body));
      expect(row.contentType).toBe('text/plain');
    });

    it('deletes both the S3 object and the row when the landed object fails the content-type allowlist', async () => {
      const key: string = `files/${ownerId}/${randomUUID()}`;

      await s3.upload({
        key,
        body: Buffer.from('<script>alert(1)</script>'),
        contentType: 'text/html',
      });

      const staleInvalid = await prisma.file.create({
        data: {
          ownerId,
          intent: FileIntentEnum.AVATAR,
          key,
          contentType: 'image/png',
          size: 0,
          status: FileStatusEnum.PENDING,
          createdAt: new Date(Date.now() - ONE_DAY_MS),
        },
      });

      await findJobOrThrow('orphan-file-sweep').run();

      const row = await prisma.file.findUnique({ where: { id: staleInvalid.id } });

      expect(row).toBeNull();
      await expect(s3.headObject(key)).resolves.toBeNull();
    });

    it('leaves a recent PENDING row untouched', async () => {
      const recent = await prisma.file.create({
        data: {
          ownerId,
          intent: FileIntentEnum.ATTACHMENT,
          key: `files/${ownerId}/${randomUUID()}`,
          contentType: 'text/plain',
          size: 0,
          status: FileStatusEnum.PENDING,
        },
      });

      await findJobOrThrow('orphan-file-sweep').run();

      const row = await prisma.file.findUniqueOrThrow({ where: { id: recent.id } });

      expect(row.status).toBe(FileStatusEnum.PENDING);
    });
  });

  // <module:payment>
  // Asserts re-enqueue via a pass-through spy on the real SqsProviderInterface
  // rather than polling receiveMessages(): this dev database has accumulated
  // a large, legitimate backlog of stale RECEIVED rows from earlier sessions
  // (the exact condition this job exists to sweep), so every run also
  // re-enqueues dozens of unrelated messages into the same shared LocalStack
  // queue — a receiveMessages(queueUrl, 10) poll racing that backlog for one
  // specific id is inherently flaky. The spy wraps (does not replace) the
  // real implementation, so the actual SQS call still happens; only the
  // assertion mechanism changes.
  describe('WebhookRetryJob', () => {
    async function seedEvent(options: {
      status: WebhookEventStatusEnum;
      attempts: number;
      ageMs: number;
    }): Promise<{ id: string }> {
      const providerEventId = `evt_retry_${randomUUID()}`;
      const row = await prisma.webhookEvent.create({
        data: {
          provider: 'STRIPE',
          providerEventId,
          type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
          payload: { providerEventId, type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED },
          status: options.status,
          attempts: options.attempts,
          createdAt: new Date(Date.now() - options.ageMs),
        },
      });

      return { id: row.id };
    }

    function enqueuedIds(sendSpy: ReturnType<typeof vi.spyOn>): string[] {
      return sendSpy.mock.calls
        .map((call: unknown[]): unknown => (call[1] as { webhookEventId?: string }).webhookEventId)
        .filter((id: unknown): id is string => typeof id === 'string');
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('is registered with the scheduler', () => {
      const job = findJobOrThrow('webhook-retry');

      expect(job.cronExpression).toBe('0 * * * *');
    });

    it('re-enqueues a stale FAILED event under the attempts ceiling and resets it to RECEIVED', async () => {
      const retryable = await seedEvent({
        status: WebhookEventStatusEnum.FAILED,
        attempts: 3,
        ageMs: TWO_HOURS_MS,
      });
      const atCeiling = await seedEvent({
        status: WebhookEventStatusEnum.FAILED,
        attempts: 8,
        ageMs: TWO_HOURS_MS,
      });
      const tooRecent = await seedEvent({
        status: WebhookEventStatusEnum.FAILED,
        attempts: 1,
        ageMs: 5 * 60 * 1000,
      });
      const sendSpy = vi.spyOn(sqs, 'sendMessage');

      await findJobOrThrow('webhook-retry').run();

      const retryableRow = await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: retryable.id },
      });

      expect(retryableRow.status).toBe(WebhookEventStatusEnum.RECEIVED);
      expect(retryableRow.attempts).toBe(3);

      const atCeilingRow = await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: atCeiling.id },
      });
      const tooRecentRow = await prisma.webhookEvent.findUniqueOrThrow({
        where: { id: tooRecent.id },
      });

      expect(atCeilingRow.status).toBe(WebhookEventStatusEnum.FAILED);
      expect(tooRecentRow.status).toBe(WebhookEventStatusEnum.FAILED);

      const enqueued: string[] = enqueuedIds(sendSpy);

      expect(enqueued).toContain(retryable.id);
      expect(enqueued).not.toContain(atCeiling.id);
      expect(enqueued).not.toContain(tooRecent.id);
    });

    it('re-enqueues a stale RECEIVED event whose ingest-time enqueue never landed (PR 5 TODO)', async () => {
      const staleReceived = await seedEvent({
        status: WebhookEventStatusEnum.RECEIVED,
        attempts: 0,
        ageMs: TWO_HOURS_MS,
      });
      const sendSpy = vi.spyOn(sqs, 'sendMessage');

      await findJobOrThrow('webhook-retry').run();

      const row = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: staleReceived.id } });

      expect(row.status).toBe(WebhookEventStatusEnum.RECEIVED);
      expect(enqueuedIds(sendSpy)).toContain(staleReceived.id);
    });
  });
  // </module:payment>
});
