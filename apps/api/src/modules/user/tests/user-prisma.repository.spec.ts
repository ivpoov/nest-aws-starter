import { MAX_PAGE_SIZE } from '@constants/pagination.constants.js';
import { AuthMethodType } from '@generated/prisma/enums.js';
import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { UnlinkMethodResultEnum } from '@modules/user/enums/unlink-method-result.enum.js';
import { UserPrismaRepository } from '@modules/user/repositories/user-prisma.repository.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
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
        OR: [{ displayName: { contains: 'ada', mode: 'insensitive' } }, { id: { in: ['user-9'] } }],
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

  // `contains` interpolates the term into a LIKE pattern unescaped, so a
  // search for `%` used to match every row and `_` every single character.
  it('escapes LIKE metacharacters so a wildcard is searched for literally', async () => {
    const { repository, user, authMethod } = createRepository();

    await repository.findManyForAdmin({ search: '100%_off\\', cursor: null, limit: 20 });

    const escaped = '100\\%\\_off\\\\';

    expect(authMethod.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { contains: escaped, mode: 'insensitive' },
        }),
      }),
    );
    expect(user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ displayName: { contains: escaped, mode: 'insensitive' } }, { id: { in: [] } }],
        }),
      }),
    );
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

interface GuardedDeleteSetupInterface {
  readonly repository: UserPrismaRepository;
  readonly authMethod: Record<string, ReturnType<typeof vi.fn>>;
  readonly queryRawTyped: ReturnType<typeof vi.fn>;
  readonly calls: string[];
}

// The transaction client is the same mock, so the order in which the guarded
// delete touches it is observable.
function createTransactionalRepository(
  methods: { type: AuthMethodType }[],
): GuardedDeleteSetupInterface {
  const calls: string[] = [];
  const authMethod: Record<string, ReturnType<typeof vi.fn>> = {
    findMany: vi.fn().mockImplementation(async (): Promise<{ type: AuthMethodType }[]> => {
      calls.push('findMany');

      return methods;
    }),
    delete: vi.fn().mockImplementation(async (): Promise<null> => {
      calls.push('delete');

      return null;
    }),
  };
  const queryRawTyped = vi.fn().mockImplementation(async (): Promise<unknown[]> => {
    calls.push('lock');

    return [];
  });
  const tx: Record<string, unknown> = { authMethod, $queryRawTyped: queryRawTyped };
  const prisma: PrismaService = {
    $transaction: async (fn: (client: unknown) => Promise<unknown>): Promise<unknown> => fn(tx),
  } as unknown as PrismaService;

  return { repository: new UserPrismaRepository(prisma), authMethod, queryRawTyped, calls };
}

describe('UserPrismaRepository.removeMethodUnlessLast', () => {
  it('takes the user row lock before it counts the methods', async () => {
    const { repository, calls } = createTransactionalRepository([
      { type: AuthMethodType.EMAIL },
      { type: AuthMethodType.GOOGLE },
    ]);

    await repository.removeMethodUnlessLast('user-1', AuthMethodTypeEnum.GOOGLE);

    // Counting before locking is the race: the count would be stale by the
    // time the delete runs.
    expect(calls).toEqual(['lock', 'findMany', 'delete']);
  });

  it('refuses to delete the only remaining method', async () => {
    const { repository, authMethod } = createTransactionalRepository([
      { type: AuthMethodType.EMAIL },
    ]);

    const result: UnlinkMethodResultEnum = await repository.removeMethodUnlessLast(
      'user-1',
      AuthMethodTypeEnum.EMAIL,
    );

    expect(result).toBe(UnlinkMethodResultEnum.LAST_METHOD);
    expect(authMethod.delete).not.toHaveBeenCalled();
  });

  it('reports a type the account does not have as not found', async () => {
    const { repository, authMethod } = createTransactionalRepository([
      { type: AuthMethodType.EMAIL },
      { type: AuthMethodType.GOOGLE },
    ]);

    const result: UnlinkMethodResultEnum = await repository.removeMethodUnlessLast(
      'user-1',
      AuthMethodTypeEnum.DISCORD,
    );

    expect(result).toBe(UnlinkMethodResultEnum.NOT_FOUND);
    expect(authMethod.delete).not.toHaveBeenCalled();
  });
});
