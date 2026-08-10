import { Prisma } from '@generated/prisma/client.js';
import { SubscriptionStatus } from '@generated/prisma/enums.js';
import { SubscriptionPrismaRepository } from '@modules/payment/repositories/subscription-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { SubscriptionStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const plan = { name: 'Pro', amountCents: 1900, currency: 'USD' };

const row = {
  id: 'sub-row-1',
  userId: 'user-1',
  planId: 'plan-1',
  status: SubscriptionStatus.ACTIVE,
  provider: 'STRIPE',
  providerRef: 'sub_1',
  providerCustomerRef: 'cus_1',
  currentPeriodEndsAt: new Date('2026-09-01T00:00:00Z'),
  canceledAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
  plan,
};

function createRepository(overrides: Record<string, ReturnType<typeof vi.fn>> = {}): {
  repository: SubscriptionPrismaRepository;
  subscription: Record<string, ReturnType<typeof vi.fn>>;
} {
  const subscription = {
    findFirst: vi.fn().mockResolvedValue(row),
    create: vi.fn().mockResolvedValue(row),
    findUnique: vi.fn().mockResolvedValue(row),
    findUniqueOrThrow: vi.fn().mockResolvedValue(row),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    update: vi.fn().mockResolvedValue(row),
    findMany: vi.fn().mockResolvedValue([row]),
    ...overrides,
  };
  const prisma = { subscription } as unknown as PrismaService;
  const repository = new SubscriptionPrismaRepository(prisma);

  return { repository, subscription };
}

describe('SubscriptionPrismaRepository.createFromCheckout', () => {
  it('creates a new ACTIVE row and reports isNew=true', async () => {
    const { repository, subscription } = createRepository();

    const result = await repository.createFromCheckout({
      userId: 'user-1',
      planId: 'plan-1',
      provider: 'STRIPE',
      providerRef: 'sub_1',
      providerCustomerRef: 'cus_1',
      currentPeriodEndsAt: row.currentPeriodEndsAt,
    });

    expect(subscription.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        planId: 'plan-1',
        provider: 'STRIPE',
        providerRef: 'sub_1',
        providerCustomerRef: 'cus_1',
        currentPeriodEndsAt: row.currentPeriodEndsAt,
        status: SubscriptionStatus.ACTIVE,
      },
      include: { plan: true },
    });
    expect(result.isNew).toBe(true);
    expect(result.subscription.status).toBe(SubscriptionStatusEnum.ACTIVE);
  });

  it('falls back to the existing row on a duplicate (P2002) and reports isNew=false', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
    });
    const { repository, subscription } = createRepository({
      create: vi.fn().mockRejectedValue(duplicate),
    });

    const result = await repository.createFromCheckout({
      userId: 'user-1',
      planId: 'plan-1',
      provider: 'STRIPE',
      providerRef: 'sub_1',
      providerCustomerRef: 'cus_1',
      currentPeriodEndsAt: row.currentPeriodEndsAt,
    });

    expect(subscription.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { provider_providerRef: { provider: 'STRIPE', providerRef: 'sub_1' } },
      include: { plan: true },
    });
    expect(result.isNew).toBe(false);
  });

  it('rethrows any other Prisma error unchanged', async () => {
    const other = new Prisma.PrismaClientKnownRequestError('Foreign key violation', {
      code: 'P2003',
      clientVersion: '7.8.0',
    });
    const { repository } = createRepository({ create: vi.fn().mockRejectedValue(other) });

    await expect(
      repository.createFromCheckout({
        userId: 'user-1',
        planId: 'plan-1',
        provider: 'STRIPE',
        providerRef: 'sub_1',
        providerCustomerRef: 'cus_1',
        currentPeriodEndsAt: row.currentPeriodEndsAt,
      }),
    ).rejects.toBe(other);
  });
});

describe('SubscriptionPrismaRepository.updatePeriodEnd', () => {
  it('issues a guarded updateMany (currentPeriodEndsAt < new value) and returns the current row', async () => {
    const { repository, subscription } = createRepository();
    const periodEndsAt = new Date('2026-10-01T00:00:00Z');

    await repository.updatePeriodEnd('sub-row-1', periodEndsAt);

    expect(subscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'sub-row-1', currentPeriodEndsAt: { lt: periodEndsAt } },
      data: { currentPeriodEndsAt: periodEndsAt },
    });
    expect(subscription.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'sub-row-1' },
      include: { plan: true },
    });
  });
});

describe('SubscriptionPrismaRepository — other reads/writes', () => {
  it('findByProviderRef maps a found row to the domain interface', async () => {
    const { repository, subscription } = createRepository();

    const result = await repository.findByProviderRef('STRIPE', 'sub_1');

    expect(subscription.findUnique).toHaveBeenCalledWith({
      where: { provider_providerRef: { provider: 'STRIPE', providerRef: 'sub_1' } },
      include: { plan: true },
    });
    expect(result?.id).toBe('sub-row-1');
  });

  it('findByProviderRef returns null when no row matches', async () => {
    const { repository } = createRepository({ findUnique: vi.fn().mockResolvedValue(null) });

    await expect(repository.findByProviderRef('STRIPE', 'missing')).resolves.toBeNull();
  });

  it('findLatestByUserId orders by id desc with no status filter', async () => {
    const { repository, subscription } = createRepository();

    await repository.findLatestByUserId('user-1');

    expect(subscription.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { id: 'desc' },
      include: { plan: true },
    });
  });

  it('updateStatus writes the mapped Prisma enum value', async () => {
    const { repository, subscription } = createRepository();

    await repository.updateStatus('sub-row-1', SubscriptionStatusEnum.CANCELED);

    expect(subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-row-1' },
      data: { status: SubscriptionStatus.CANCELED },
      include: { plan: true },
    });
  });

  it('setCanceledAt writes the given timestamp', async () => {
    const { repository, subscription } = createRepository();
    const canceledAt = new Date('2026-08-04T00:00:00Z');

    await repository.setCanceledAt('sub-row-1', canceledAt);

    expect(subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-row-1' },
      data: { canceledAt },
      include: { plan: true },
    });
  });

  // The sweep is bounded and ordered: unbounded, a backlog would have loaded
  // every overdue row into memory at once, and without the ordering a capped
  // run could keep re-reading the same arbitrary slice and starve the oldest.
  it('findOverdue queries ACTIVE/PAST_DUE rows past the cutoff, capped and oldest first', async () => {
    const { repository, subscription } = createRepository();
    const cutoff = new Date('2026-08-01T00:00:00Z');

    const result = await repository.findOverdue(cutoff, 200);

    expect(subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        currentPeriodEndsAt: { lt: cutoff },
      },
      include: { plan: true },
      orderBy: { currentPeriodEndsAt: 'asc' },
      take: 200,
    });
    expect(result).toHaveLength(1);
  });
});
