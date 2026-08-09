import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import { PlanPrismaRepository } from '@modules/payment/repositories/plan-prisma.repository.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { describe, expect, it, vi } from 'vitest';

const row = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  name: 'Pro',
  description: 'Everything',
  amountCents: 1900,
  currency: 'USD',
  interval: 'MONTH',
  providerPriceId: 'price_1',
  isActive: true,
  createdAt: new Date('2026-08-03T12:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
};

function createRepository(): {
  repository: PlanPrismaRepository;
  plan: Record<string, ReturnType<typeof vi.fn>>;
} {
  const plan = { findMany: vi.fn().mockResolvedValue([row]) };
  const prisma = { plan } as unknown as PrismaService;

  return { repository: new PlanPrismaRepository(prisma), plan };
}

describe('PlanPrismaRepository.findManyActive', () => {
  it('caps the public plan list at the shared page-size budget', async () => {
    const { repository, plan } = createRepository();

    await repository.findManyActive();

    expect(plan.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      take: MAX_PAGE_SIZE,
      orderBy: { amountCents: 'asc' },
    });
  });
});
