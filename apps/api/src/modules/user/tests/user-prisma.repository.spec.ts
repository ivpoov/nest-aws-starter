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
    const { repository, user, authMethod } = createRepository();

    authMethod.findMany.mockResolvedValue([{ userId: 'user-9' }, { userId: 'user-9' }]);

    await repository.findManyForAdmin({ search: 'ada', cursor: 'user-0', limit: 20 });

    expect(user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { displayName: { contains: 'ada', mode: 'insensitive' } },
          { id: { in: ['user-9'] } },
        ],
        id: { lt: 'user-0' },
      },
      include: { authMethods: { select: { type: true, email: true } } },
      take: 20,
      orderBy: { id: 'desc' },
    });
  });

  // The email half used to ride along as an `authMethods: { some: ... }`
  // sub-condition, which Postgres cannot fold into a BitmapOr with the
  // display-name predicate — so the users table was scanned in full however
  // it was indexed. Resolving it to ids first is what makes both sides
  // index-scannable, and the lookup itself has to stay bounded and cursored.
  it('resolves the email half to a bounded, cursored id list of its own', async () => {
    const { repository, authMethod } = createRepository();

    await repository.findManyForAdmin({ search: 'ada', cursor: 'user-0', limit: 20 });

    expect(authMethod.findMany).toHaveBeenCalledWith({
      where: {
        email: { contains: 'ada', mode: 'insensitive' },
        userId: { lt: 'user-0' },
      },
      select: { userId: true },
      orderBy: { userId: 'desc' },
      take: 80,
    });
  });

  it('does not query auth methods at all when no search term is given', async () => {
    const { repository, authMethod, user } = createRepository();

    await repository.findManyForAdmin({ search: null, cursor: null, limit: 20 });

    expect(authMethod.findMany).not.toHaveBeenCalled();
    expect(user.findMany).toHaveBeenCalledWith({
      where: {},
      include: { authMethods: { select: { type: true, email: true } } },
      take: 20,
      orderBy: { id: 'desc' },
    });
  });
});
