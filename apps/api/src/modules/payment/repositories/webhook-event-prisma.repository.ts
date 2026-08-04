import { Prisma } from '@generated/prisma/client.js';
import type { WebhookEventModel } from '@generated/prisma/models.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';
import type { WebhookEventInterface } from '@modules/payment/interfaces/webhook-event.interface.js';
import type { WebhookEventRepositoryInterface } from '@modules/payment/interfaces/webhook-event-repository.interface.js';
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
