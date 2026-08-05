import { type PaymentConfig, paymentConfig } from '@configs/payment.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { WEBHOOK_EVENT_REPOSITORY } from '@modules/payment/constants/payment.constants.js';
import {
  EMPTY_POLL_INTERVAL_MS,
  MAX_MESSAGES_PER_POLL,
  MAX_WEBHOOK_ATTEMPTS,
  WEBHOOK_LOCK_KEY_PREFIX,
  WEBHOOK_LOCK_TTL_MS,
} from '@modules/payment/constants/webhook-consumer.constants.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { WebhookEventDispatcherService } from '@modules/payment/services/webhook-event-dispatcher.service.js';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { RedisLockService } from '@providers/redis/services/redis-lock.service.js';
import { SQS_PROVIDER } from '@providers/sqs/constants/sqs.constants.js';
import type { SqsMessageInterface } from '@providers/sqs/interfaces/sqs-message.interface.js';
import type { SqsProviderInterface } from '@providers/sqs/interfaces/sqs-provider.interface.js';

// Idempotency levels 2 (status short-circuit) + 3 (per-event Redis lock)
// from the plan. The long-poll loop is app-lifecycle managed
// (OnApplicationBootstrap/OnApplicationShutdown) but every step it drives is
// also a public/exposed method so e2e suites can call processMessage()
// directly instead of racing the loop's own poll interval — see
// test/webhook-consumer.e2e-spec.ts.
@Injectable()
export class PaymentWebhookConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new CustomLoggerService(PaymentWebhookConsumerService.name);
  private isStopping: boolean = false;
  private loopPromise: Promise<void> | null = null;
  private loopSettled: boolean = false;

  constructor(
    @Inject(WEBHOOK_EVENT_REPOSITORY)
    private readonly webhookEventRepository: WebhookEventRepositoryInterface,
    @Inject(SQS_PROVIDER)
    private readonly sqsProvider: SqsProviderInterface,
    private readonly redisLock: RedisLockService,
    private readonly dispatcher: WebhookEventDispatcherService,
    @Inject(paymentConfig.KEY)
    private readonly payment: PaymentConfig,
  ) {}

  public onApplicationBootstrap(): void {
    if (!this.payment.consumerEnabled) {
      this.logger.log(
        'Webhook consumer disabled (PAYMENT_WEBHOOK_CONSUMER_ENABLED=false) — no long-poll loop started',
      );

      return;
    }

    this.isStopping = false;
    this.loopSettled = false;
    // .finally() keeps loopSettled honest even in the (now theoretical,
    // since every iteration below is self-contained) case the loop still
    // exits abnormally — isLoopRunning() reflects reality, not just whether
    // stop() was requested.
    this.loopPromise = this.runLoop().finally(() => {
      this.loopSettled = true;
    });
  }

  public async onApplicationShutdown(): Promise<void> {
    this.isStopping = true;

    if (this.loopPromise) await this.loopPromise;
  }

  // Exposed so tests can assert the loop actually stops instead of just
  // flipping the flag and hoping.
  public isLoopRunning(): boolean {
    return this.loopPromise !== null && !this.isStopping && !this.loopSettled;
  }

  private async runLoop(): Promise<void> {
    this.logger.log('Webhook consumer loop started');

    while (!this.isStopping) await this.runLoopIteration();

    this.logger.log('Webhook consumer loop stopped');
  }

  // One full iteration — receive + drain the batch — wrapped in its own
  // try/catch: a transient SQS throttle or Postgres hiccup must never
  // escape here. runLoop() is fire-and-forget from onApplicationBootstrap
  // (no caller ever awaits/catches it), so an uncaught rejection would be a
  // top-level unhandled rejection that kills the process by default —
  // mirrors TaskSchedulerRunnerService.runJob's per-run try/catch.
  private async runLoopIteration(): Promise<void> {
    try {
      const messages: SqsMessageInterface[] = await this.sqsProvider.receiveMessages(
        this.payment.webhookQueueUrl,
        MAX_MESSAGES_PER_POLL,
      );

      if (messages.length === 0) {
        await this.sleep(EMPTY_POLL_INTERVAL_MS);

        return;
      }

      await this.processMessages(messages);
    } catch (caught) {
      this.logError('Webhook consumer loop iteration failed', caught);
      await this.sleep(EMPTY_POLL_INTERVAL_MS);
    }
  }

  // Public (like processMessage) so tests can prove containment directly:
  // one message throwing must never stop the batch or escape as an
  // unhandled rejection — see payment-webhook-consumer.service.spec.ts.
  public async processMessages(messages: SqsMessageInterface[]): Promise<void> {
    for (const message of messages) {
      if (this.isStopping) break;

      try {
        await this.processMessage(message);
      } catch (caught) {
        this.logError(
          `Webhook message processing failed, left for redelivery: ${message.messageId}`,
          caught,
        );
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // The single unit of work — receive loop and e2e suites both call this.
  public async processMessage(message: SqsMessageInterface): Promise<void> {
    const webhookEventId: string | null = this.parseWebhookEventId(message.body);

    if (!webhookEventId) {
      this.logger.error(`Unparseable webhook queue message, dropping: ${message.messageId}`);
      await this.sqsProvider.deleteMessage(this.payment.webhookQueueUrl, message.receiptHandle);

      return;
    }

    const shouldDelete: boolean = await this.process(webhookEventId);

    if (shouldDelete) {
      await this.sqsProvider.deleteMessage(this.payment.webhookQueueUrl, message.receiptHandle);
    }
  }

  private parseWebhookEventId(body: string): string | null {
    try {
      const parsed: unknown = JSON.parse(body);

      return this.extractWebhookEventId(parsed);
    } catch (caught) {
      this.logError('Failed to parse webhook queue message body', caught);

      return null;
    }
  }

  private extractWebhookEventId(parsed: unknown): string | null {
    if (!parsed || typeof parsed !== 'object') return null;

    const value: unknown = (parsed as Record<string, unknown>).webhookEventId;

    return typeof value === 'string' ? value : null;
  }

  // Fast-path status check (idempotency level 2), outside the lock — avoids
  // paying for a Redis round-trip on every redelivery of an already-terminal
  // event. The authoritative check happens again inside the lock.
  private async process(webhookEventId: string): Promise<boolean> {
    const event: WebhookEventInterface | null =
      await this.webhookEventRepository.findById(webhookEventId);

    if (!event) {
      this.logger.warn(`Webhook event row not found, dropping message: ${webhookEventId}`);

      return true;
    }

    if (this.isTerminal(event.status)) return true;

    return this.acquireLockAndProcess(webhookEventId);
  }

  // null from withLock means another consumer holds the lock and is
  // actively processing this event (idempotency level 3) — the message must
  // NOT be deleted; SQS's visibility timeout redelivers it for a later
  // re-check instead of risking event loss if the current holder crashes
  // mid-dispatch.
  private async acquireLockAndProcess(webhookEventId: string): Promise<boolean> {
    const result: boolean | null = await this.redisLock.withLock<boolean>(
      `${WEBHOOK_LOCK_KEY_PREFIX}${webhookEventId}`,
      WEBHOOK_LOCK_TTL_MS,
      (): Promise<boolean> => this.processLocked(webhookEventId),
    );

    if (result === null) {
      this.logger.debug(
        `Webhook lock held elsewhere, leaving message for redelivery: ${webhookEventId}`,
      );

      return false;
    }

    return result;
  }

  private async processLocked(webhookEventId: string): Promise<boolean> {
    const event: WebhookEventInterface | null =
      await this.webhookEventRepository.findById(webhookEventId);

    if (!event || this.isTerminal(event.status)) return true;

    if (event.type === NormalizedEventTypeEnum.UNHANDLED) {
      await this.webhookEventRepository.markSkipped(webhookEventId);

      return true;
    }

    return this.dispatchAndRecord(event);
  }

  private async dispatchAndRecord(event: WebhookEventInterface): Promise<boolean> {
    try {
      await this.dispatcher.dispatch(event);
      await this.webhookEventRepository.markProcessed(event.id);

      return true;
    } catch (caught) {
      return this.recordDispatchFailure(event.id, caught);
    }
  }

  private async recordDispatchFailure(webhookEventId: string, caught: unknown): Promise<boolean> {
    const message: string = this.extractErrorMessage(caught);
    const attempts: number = await this.webhookEventRepository.recordFailure(
      webhookEventId,
      message,
    );

    this.logError(
      `Webhook event dispatch failed (attempt ${attempts}/${MAX_WEBHOOK_ATTEMPTS}): ${webhookEventId}`,
      caught,
    );

    if (attempts < MAX_WEBHOOK_ATTEMPTS) return false;

    await this.webhookEventRepository.markFailed(webhookEventId);
    this.logger.error(`Webhook event exhausted retries, marked FAILED: ${webhookEventId}`);

    return true;
  }

  private isTerminal(status: WebhookEventStatusEnum): boolean {
    return status === WebhookEventStatusEnum.PROCESSED || status === WebhookEventStatusEnum.SKIPPED;
  }

  private extractErrorMessage(caught: unknown): string {
    return caught instanceof Error ? caught.message : String(caught);
  }

  private logError(context: string, caught: unknown): void {
    const message: string = this.extractErrorMessage(caught);
    const stack: string | undefined = caught instanceof Error ? caught.stack : undefined;

    this.logger.error(`${context} — ${message}`, stack);
  }
}
