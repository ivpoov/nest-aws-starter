import { Prisma } from '@generated/prisma/client.js';
import type { WebhookEventModel } from '@generated/prisma/models.js';
import type { TransactionContextInterface } from '@interfaces/transaction-context.interface.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
import { resolvePrismaClient } from '@modules/prisma/helpers/resolve-prisma-client.helper.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WebhookEventPrismaRepository implements WebhookEventRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async upsertReceived(
    provider: string,
    providerEventId: string,
    type: string,
    payload: ProviderEventInterface,
  ): Promise<UpsertWebhookEventResultInterface> {
    try {
      const created: WebhookEventModel = await this.prisma.webhookEvent.create({
        data: { provider, providerEventId, type, payload: this.toJson(payload) },
      });

      return { event: this.toDomain(created), isNew: true };
    } catch (caught) {
      if (!this.isDuplicate(caught)) throw caught;

      return { event: await this.findExistingOrThrow(provider, providerEventId), isNew: false };
    }
  }

  private async findExistingOrThrow(
    provider: string,
    providerEventId: string,
  ): Promise<WebhookEventInterface> {
    const existing: WebhookEventModel = await this.prisma.webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider, providerEventId } },
    });

    return this.toDomain(existing);
  }

  public async findById(id: string): Promise<WebhookEventInterface | null> {
    const webhookEvent: WebhookEventModel | null = await this.prisma.webhookEvent.findUnique({
      where: { id },
    });

    return webhookEvent ? this.toDomain(webhookEvent) : null;
  }

  public async markProcessed(id: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: WebhookEventStatusEnum.PROCESSED, processedAt: new Date() },
    });
  }

  public async markSkipped(id: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: WebhookEventStatusEnum.SKIPPED, processedAt: new Date() },
    });
  }

  public async markFailed(id: string, tx?: TransactionContextInterface): Promise<void> {
    const client: Prisma.TransactionClient = resolvePrismaClient(this.prisma, tx);

    await client.webhookEvent.update({
      where: { id },
      data: { status: WebhookEventStatusEnum.FAILED, processedAt: new Date() },
    });
  }

  public async recordFailure(
    id: string,
    error: string,
    tx?: TransactionContextInterface,
  ): Promise<number> {
    const client: Prisma.TransactionClient = resolvePrismaClient(this.prisma, tx);
    const updated: WebhookEventModel = await client.webhookEvent.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: error },
    });

    return updated.attempts;
  }

  public async findRetryableFailed(
    cutoff: Date,
    maxAttempts: number,
    limit: number,
  ): Promise<WebhookEventInterface[]> {
    const events: WebhookEventModel[] = await this.prisma.webhookEvent.findMany({
      where: {
        status: WebhookEventStatusEnum.FAILED,
        createdAt: { lt: cutoff },
        attempts: { lt: maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return events.map((event: WebhookEventModel): WebhookEventInterface => this.toDomain(event));
  }

  public async findStaleReceived(cutoff: Date, limit: number): Promise<WebhookEventInterface[]> {
    const events: WebhookEventModel[] = await this.prisma.webhookEvent.findMany({
      where: { status: WebhookEventStatusEnum.RECEIVED, createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return events.map((event: WebhookEventModel): WebhookEventInterface => this.toDomain(event));
  }

  public async markRetryQueued(id: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id },
      data: { status: WebhookEventStatusEnum.RECEIVED },
    });
  }

  // Deliberate extension of the "P2025 is the single permitted Prisma-error
  // touchpoint" convention (docs/conventions/backend.md §11): P2002 (unique
  // violation) is this repository's own confined signal for idempotent
  // replay, same spirit as P2025 — flagged here for release review rather
  // than silently widening the rule.
  private isDuplicate(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002';
  }

  private toJson(payload: ProviderEventInterface): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
  }

  private toDomain(webhookEvent: WebhookEventModel): WebhookEventInterface {
    return {
      id: webhookEvent.id,
      provider: webhookEvent.provider,
      providerEventId: webhookEvent.providerEventId,
      type: webhookEvent.type,
      payload: webhookEvent.payload as Record<string, unknown>,
      status: WebhookEventStatusEnum[webhookEvent.status],
      attempts: webhookEvent.attempts,
      lastError: webhookEvent.lastError,
      createdAt: webhookEvent.createdAt,
      processedAt: webhookEvent.processedAt,
    };
  }
}
