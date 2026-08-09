import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { SessionPrismaRepository } from '@modules/session/repositories/session-prisma.repository.js';
import { describe, expect, it, vi } from 'vitest';

function createRepository(): {
  repository: SessionPrismaRepository;
  session: Record<string, ReturnType<typeof vi.fn>>;
} {
  const session = { findMany: vi.fn().mockResolvedValue([]) };
  const prisma = { session } as unknown as PrismaService;

  return { repository: new SessionPrismaRepository(prisma), session };
}

describe('SessionPrismaRepository.findActiveByUserId', () => {
  it('caps the session list at the shared page-size budget', async () => {
    const { repository, session } = createRepository();
    const now: Date = new Date('2026-08-03T12:00:00Z');

    await repository.findActiveByUserId('user-1', now);

    expect(session.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', activeUntil: { gt: now } },
      take: MAX_PAGE_SIZE,
      orderBy: { lastActiveAt: 'desc' },
    });
  });
});
