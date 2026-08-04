import { ConflictError } from '@modules/common/errors/conflict.error.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { UserAdminService } from '@modules/user/services/user-admin.service.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const adminId = '01890a5d-0000-774b-bcce-b30209990001';
const userId = '01890a5d-0000-774b-bcce-b30209990002';

const adminUser: AdminUserInterface = {
  id: userId,
  displayName: 'Target',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  email: 'target@example.com',
  methodTypes: [AuthMethodTypeEnum.EMAIL],
  createdAt: new Date('2026-08-03T12:00:00Z'),
  updatedAt: new Date('2026-08-03T12:00:00Z'),
};

function createService(): {
  service: UserAdminService;
  findByIdForAdminOrThrow: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  assertNotSelfBlock: ReturnType<typeof vi.fn>;
  revokeAllForUser: ReturnType<typeof vi.fn>;
} {
  const findByIdForAdminOrThrow = vi.fn().mockResolvedValue(adminUser);
  const updateStatus = vi.fn().mockResolvedValue({
    ...adminUser,
    status: UserStatusEnum.BLOCKED,
    updatedAt: new Date('2026-08-03T13:00:00Z'),
  } satisfies UserInterface);
  const assertNotSelfBlock = vi.fn();
  const userService = {
    findByIdForAdminOrThrow,
    updateStatus,
    assertNotSelfBlock,
  } as unknown as UserService;

  const revokeAllForUser = vi.fn().mockResolvedValue(1);
  const sessionService = { revokeAllForUser } as unknown as SessionService;

  return {
    service: new UserAdminService(userService, sessionService),
    findByIdForAdminOrThrow,
    updateStatus,
    assertNotSelfBlock,
    revokeAllForUser,
  };
}

describe('UserAdminService.updateStatus', () => {
  it('revokes sessions before writing the BLOCKED status', async () => {
    const { service, updateStatus, revokeAllForUser } = createService();
    const order: string[] = [];

    revokeAllForUser.mockImplementation(async (): Promise<number> => {
      order.push('revoke');

      return 1;
    });
    updateStatus.mockImplementation(async (): Promise<UserInterface> => {
      order.push('updateStatus');

      return { ...adminUser, status: UserStatusEnum.BLOCKED };
    });

    await service.updateStatus(adminId, userId, UserStatusEnum.BLOCKED);

    expect(order).toEqual(['revoke', 'updateStatus']);
  });

  it('does not revoke sessions when unblocking', async () => {
    const { service, revokeAllForUser, updateStatus } = createService();

    await service.updateStatus(adminId, userId, UserStatusEnum.ACTIVE);

    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith(userId, UserStatusEnum.ACTIVE, adminId, undefined);
  });

  it('threads an optional reason through to the service', async () => {
    const { service, updateStatus } = createService();

    await service.updateStatus(adminId, userId, UserStatusEnum.BLOCKED, 'Repeated ToS violations');

    expect(updateStatus).toHaveBeenCalledWith(
      userId,
      UserStatusEnum.BLOCKED,
      adminId,
      'Repeated ToS violations',
    );
  });

  it('aborts on self-block before revoking any session', async () => {
    const { service, assertNotSelfBlock, revokeAllForUser, updateStatus } = createService();

    assertNotSelfBlock.mockImplementation((): void => {
      throw new ConflictError({ code: 'USER_CANNOT_BLOCK_SELF', details: 'nope' });
    });

    await expect(
      service.updateStatus(adminId, adminId, UserStatusEnum.BLOCKED),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  // The core safety property under test: a mid-flight failure must never
  // leave a user BLOCKED-in-name-only with live sessions. Revoking first
  // means a revoke failure aborts before any write or event.
  it('leaves the status untouched and emits nothing when session revocation fails', async () => {
    const { service, revokeAllForUser, updateStatus } = createService();

    revokeAllForUser.mockRejectedValue(new Error('redis unavailable'));

    await expect(service.updateStatus(adminId, userId, UserStatusEnum.BLOCKED)).rejects.toThrow(
      'redis unavailable',
    );

    // updateStatus is the only place that writes the status column and emits
    // user.blocked/user.unblocked — it never having been called proves both
    // "status not changed" and "no event emitted" in one assertion.
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('fetches the admin-shaped user exactly once, merging it with the write result', async () => {
    const { service, findByIdForAdminOrThrow } = createService();

    const result: AdminUserInterface = await service.updateStatus(
      adminId,
      userId,
      UserStatusEnum.BLOCKED,
    );

    expect(findByIdForAdminOrThrow).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ...adminUser,
      status: UserStatusEnum.BLOCKED,
      updatedAt: new Date('2026-08-03T13:00:00Z'),
    });
  });
});
