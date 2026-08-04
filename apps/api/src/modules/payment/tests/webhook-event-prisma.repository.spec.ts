import { Prisma } from '@generated/prisma/client.js';
import { NormalizedEventTypeEnum } from '@modules/payment/enums/normalized-event-type.enum.js';
import { WebhookEventStatusEnum } from '@modules/payment/enums/webhook-event-status.enum.js';
import type { ProviderEventInterface } from '@modules/payment/interfaces/provider-event.interface.js';
import type { UpsertWebhookEventResultInterface } from '@modules/payment/interfaces/upsert-webhook-event-result.interface.js';
import { WebhookEventPrismaRepository } from '@modules/payment/repositories/webhook-event-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { describe, expect, it, vi } from 'vitest';

const payload: ProviderEventInterface = {
  providerEventId: 'evt_123',
  type: NormalizedEventTypeEnum.CHECKOUT_COMPLETED,
};

const row = {
  id: '01890a5d-0000-774b-bcce-b302099c0001',
  provider: 'STRIPE',
  providerEventId: 'evt_123',
  type: 'CHECKOUT_COMPLETED',
  payload,
  status: 'RECEIVED',
  attempts: 0,
  lastError: null,
  createdAt: new Date('2026-08-04T00:00:00Z'),
  processedAt: null,
};

function createRepository(overrides: Record<string, ReturnType<typeof vi.fn>> = {}): {
  repository: WebhookEventPrismaRepository;
  webhookEvent: Record<string, ReturnType<typeof vi.fn>>;
} {
  const webhookEvent = {
    create: vi.fn().mockResolvedValue(row),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    ...overrides,
  };
  const prisma = { webhookEvent } as unknown as PrismaService;
  const repository = new WebhookEventPrismaRepository(prisma);

  return { repository, webhookEvent };
}

describe('WebhookEventPrismaRepository.upsertReceived', () => {
  it('creates a new row and maps it to the domain interface', async () => {
    const { repository, webhookEvent } = createRepository();

    const result: UpsertWebhookEventResultInterface = await repository.upsertReceived(
      'STRIPE',
      'evt_123',
      'CHECKOUT_COMPLETED',
      payload,
    );

    expect(webhookEvent.create).toHaveBeenCalledWith({
      data: { provider: 'STRIPE', providerEventId: 'evt_123', type: 'CHECKOUT_COMPLETED', payload },
    });
    expect(result).toEqual({
      isNew: true,
      event: {
        id: row.id,
        provider: row.provider,
        providerEventId: row.providerEventId,
        type: row.type,
        payload,
        status: WebhookEventStatusEnum.RECEIVED,
        attempts: 0,
        lastError: null,
        createdAt: row.createdAt,
        processedAt: null,
      },
    });
  });

  it('falls back to the existing row on a duplicate (P2002) and reports isNew=false', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
    });
    const { repository, webhookEvent } = createRepository({
      create: vi.fn().mockRejectedValue(duplicate),
    });

    const result: UpsertWebhookEventResultInterface = await repository.upsertReceived(
      'STRIPE',
      'evt_123',
      'CHECKOUT_COMPLETED',
      payload,
    );

    expect(webhookEvent.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { provider_providerEventId: { provider: 'STRIPE', providerEventId: 'evt_123' } },
    });
    expect(result.isNew).toBe(false);
    expect(result.event.id).toBe(row.id);
  });

  it('rethrows any other Prisma error unchanged', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ create: vi.fn().mockRejectedValue(other) });

    await expect(
      repository.upsertReceived('STRIPE', 'evt_123', 'CHECKOUT_COMPLETED', payload),
    ).rejects.toBe(other);
  });
});
