import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { UserPrismaRepository } from '@modules/user/repositories/user-prisma.repository.js';
import { describe, expect, it, vi } from 'vitest';

function createRepository(): {
  repository: UserPrismaRepository;
  authMethod: Record<string, ReturnType<typeof vi.fn>>;
  user: Record<string, ReturnType<typeof vi.fn>>;
} {
  const authMethod = { findMany: vi.fn().mockResolvedValue([]) };
  const user = { findMany: vi.fn().mockResolvedValue([]) };
  const prisma = { authMethod, user } as unknown as PrismaService;

  return { repository: new UserPrismaRepository(prisma), authMethod, user };
}

describe('UserPrismaRepository.findMethodsByUserId', () => {
  it('caps the auth-method list at the shared page-size budget', async () => {
    const { repository, authMethod } = createRepository();

    await repository.findMethodsByUserId('user-1');

    expect(authMethod.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      take: MAX_PAGE_SIZE,
      orderBy: { createdAt: 'asc' },
    });
  });
});

describe('UserPrismaRepository.findManyForAdmin', () => {
  it('keysets the cursor into the where clause instead of offsetting past it', async () => {
    const { repository, user } = createRepository();

    await repository.findManyForAdmin({ search: 'ada', cursor: 'user-0', limit: 20 });

    expect(user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { displayName: { contains: 'ada', mode: 'insensitive' } },
          { authMethods: { some: { email: { contains: 'ada', mode: 'insensitive' } } } },
        ],
        id: { lt: 'user-0' },
      },
      include: { authMethods: { select: { type: true, email: true } } },
      take: 20,
      orderBy: { id: 'desc' },
    });
  });
});
