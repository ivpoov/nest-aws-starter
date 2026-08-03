import { ConflictError } from '@modules/common/errors/conflict.error.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import { UserAdminController } from '@modules/user/controllers/user-admin.controller.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
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

function createController(): {
  controller: UserAdminController;
  findByIdForAdminOrThrow: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  assertNotSelfBlock: ReturnType<typeof vi.fn>;
  revokeAllForUser: ReturnType<typeof vi.fn>;
} {
  const findByIdForAdminOrThrow = vi.fn().mockResolvedValue(adminUser);
  const updateStatus = vi.fn().mockResolvedValue({ ...adminUser, status: UserStatusEnum.BLOCKED });
  const assertNotSelfBlock = vi.fn();
  const userService = {
    findByIdForAdminOrThrow,
    updateStatus,
    assertNotSelfBlock,
  } as unknown as UserService;

  const revokeAllForUser = vi.fn().mockResolvedValue(1);
  const sessionService = { revokeAllForUser } as unknown as SessionService;

  return {
    controller: new UserAdminController(userService, sessionService),
    findByIdForAdminOrThrow,
    updateStatus,
    assertNotSelfBlock,
    revokeAllForUser,
  };
}

describe('UserAdminController.updateStatus', () => {
  it('revokes sessions before writing the BLOCKED status', async () => {
    const { controller, updateStatus, revokeAllForUser } = createController();
    const order: string[] = [];

    revokeAllForUser.mockImplementation(async (): Promise<number> => {
      order.push('revoke');

      return 1;
    });
    updateStatus.mockImplementation(async (): Promise<AdminUserInterface> => {
      order.push('updateStatus');

      return { ...adminUser, status: UserStatusEnum.BLOCKED };
    });

    await controller.updateStatus(adminId, userId, { status: UserStatusEnum.BLOCKED });

    expect(order).toEqual(['revoke', 'updateStatus']);
  });

  it('does not revoke sessions when unblocking', async () => {
    const { controller, revokeAllForUser, updateStatus } = createController();

    await controller.updateStatus(adminId, userId, { status: UserStatusEnum.ACTIVE });

    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(updateStatus).toHaveBeenCalledWith(userId, UserStatusEnum.ACTIVE, adminId);
  });

  it('aborts on self-block before revoking any session', async () => {
    const { controller, assertNotSelfBlock, revokeAllForUser, updateStatus } = createController();

    assertNotSelfBlock.mockImplementation((): void => {
      throw new ConflictError({ code: 'USER_CANNOT_BLOCK_SELF', details: 'nope' });
    });

    await expect(
      controller.updateStatus(adminId, adminId, { status: UserStatusEnum.BLOCKED }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(revokeAllForUser).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  // The core safety property under test: a mid-flight failure must never
  // leave a user BLOCKED-in-name-only with live sessions. Revoking first
  // means a revoke failure aborts before any write or event.
  it('leaves the status untouched and emits nothing when session revocation fails', async () => {
    const { controller, revokeAllForUser, updateStatus } = createController();

    revokeAllForUser.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      controller.updateStatus(adminId, userId, { status: UserStatusEnum.BLOCKED }),
    ).rejects.toThrow('redis unavailable');

    // updateStatus is the only place that writes the status column and emits
    // user.blocked/user.unblocked — it never having been called proves both
    // "status not changed" and "no event emitted" in one assertion.
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
