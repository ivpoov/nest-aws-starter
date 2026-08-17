import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserRepositoryInterface } from '@modules/user/interfaces/user-repository.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const user: UserInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  displayName: 'Igor',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  createdAt: new Date('2026-08-03T12:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
};

const adminId = '01890a5d-ac96-774b-bcce-b302099a9999';

function createService(overrides: Partial<UserRepositoryInterface> = {}): {
  service: UserService;
  emit: ReturnType<typeof vi.fn>;
} {
  // Only the methods this suite exercises are stubbed. `satisfies` still checks
  // every name and signature that IS here, so a renamed or re-typed repository
  // method breaks the build; the cast covers absence alone, and a service
  // reaching for an unstubbed method fails loudly as "not a function".
  const stubs = {
    createWithEmailMethod: vi.fn().mockResolvedValue(user),
    createWithOauthMethod: vi.fn().mockResolvedValue(user),
    findById: vi.fn().mockResolvedValue(user),
    findByAuthEmail: vi.fn().mockResolvedValue(null),
    updateProfile: vi.fn().mockResolvedValue(user),
    updateStatus: vi.fn().mockResolvedValue(user),
    ...overrides,
  } satisfies Partial<UserRepositoryInterface>;
  const repository: UserRepositoryInterface = stubs as UserRepositoryInterface;
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;

  return { service: new UserService(repository, eventBus), emit };
}

describe('UserService', () => {
  it('creates a user with an email method', async () => {
    const { service } = createService();

    const created: UserInterface = await service.createWithEmailMethod({
      displayName: 'Igor',
      email: 'igor@example.com',
      passwordHash: 'argon2-hash',
    });

    expect(created).toEqual(user);
  });

  it('throws the coded not-found error for a missing user', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(null) });

    try {
      await service.findByIdOrThrow('missing-id');
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('USER_NOT_FOUND');
    }
  });

  it('maps a profile update of a vanished user to the domain 404', async () => {
    const { service } = createService({
      updateProfile: vi.fn().mockResolvedValue(null),
    });

    await expect(service.updateProfile(user.id, { displayName: 'New' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('passes findByAuthEmail through to the repository', async () => {
    const findByAuthEmail = vi.fn().mockResolvedValue(null);
    const { service } = createService({ findByAuthEmail });

    const result = await service.findByAuthEmail('nobody@example.com');

    expect(result).toBeNull();
    expect(findByAuthEmail).toHaveBeenCalledWith('nobody@example.com');
  });

  it('blocks a user and emits user.blocked', async () => {
    const updateStatus = vi.fn().mockResolvedValue({ ...user, status: UserStatusEnum.BLOCKED });
    const { service, emit } = createService({ updateStatus });

    const updated: UserInterface = await service.updateStatus(
      user.id,
      UserStatusEnum.BLOCKED,
      adminId,
    );

    expect(updateStatus).toHaveBeenCalledWith(user.id, UserStatusEnum.BLOCKED);
    expect(updated.status).toBe(UserStatusEnum.BLOCKED);
    expect(emit).toHaveBeenCalledWith('user.blocked', { userId: user.id, actorId: adminId });
  });

  it('unblocks a user and emits user.unblocked', async () => {
    const { service, emit } = createService();

    await service.updateStatus(user.id, UserStatusEnum.ACTIVE, adminId);

    expect(emit).toHaveBeenCalledWith('user.unblocked', { userId: user.id, actorId: adminId });
  });

  it('includes the reason in the emitted event when the admin provides one', async () => {
    const updateStatus = vi.fn().mockResolvedValue({ ...user, status: UserStatusEnum.BLOCKED });
    const { service, emit } = createService({ updateStatus });

    await service.updateStatus(user.id, UserStatusEnum.BLOCKED, adminId, 'Repeated ToS violations');

    expect(emit).toHaveBeenCalledWith('user.blocked', {
      userId: user.id,
      actorId: adminId,
      reason: 'Repeated ToS violations',
    });
  });

  it('omits the reason key entirely when the admin does not provide one', async () => {
    const { service, emit } = createService();

    await service.updateStatus(user.id, UserStatusEnum.ACTIVE, adminId);

    const [, payload] = emit.mock.calls[0] as [string, Record<string, unknown>];

    expect('reason' in payload).toBe(false);
  });

  it('rejects an admin blocking their own account', async () => {
    const updateStatus = vi.fn();
    const { service, emit } = createService({ updateStatus });

    try {
      await service.updateStatus(adminId, UserStatusEnum.BLOCKED, adminId);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ConflictError);
      expect((caught as ConflictError).args.code).toBe('USER_CANNOT_BLOCK_SELF');
    }

    expect(updateStatus).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('maps a status update of a vanished user to the domain 404', async () => {
    const { service } = createService({ updateStatus: vi.fn().mockResolvedValue(null) });

    await expect(
      service.updateStatus(user.id, UserStatusEnum.BLOCKED, adminId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('UserService.assertCanImpersonate', () => {
  const targetBase: AdminUserInterface = {
    ...user,
    email: 'target@example.com',
    methodTypes: [AuthMethodTypeEnum.EMAIL],
  };

  it('allows an ACTIVE USER-role target', () => {
    const { service } = createService();

    expect(() => service.assertCanImpersonate(targetBase)).not.toThrow();
  });

  it('rejects an ADMIN target with a coded forbidden error', () => {
    const { service } = createService();

    try {
      service.assertCanImpersonate({ ...targetBase, role: UserRoleEnum.ADMIN });
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('ADMIN_CANNOT_IMPERSONATE_ADMIN');
    }
  });

  it('rejects a BLOCKED target with the shared USER_BLOCKED code', () => {
    const { service } = createService();

    try {
      service.assertCanImpersonate({ ...targetBase, status: UserStatusEnum.BLOCKED });
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('USER_BLOCKED');
    }
  });
});
