import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { OauthFlowService } from '@modules/oauth/services/oauth-flow.service.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import { UserAdminController } from '@modules/user/controllers/user-admin.controller.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import type { UserAdminService } from '@modules/user/services/user-admin.service.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import type { FastifyRequest } from 'fastify';
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
  assertCanImpersonate: ReturnType<typeof vi.fn>;
  updateStatus: ReturnType<typeof vi.fn>;
  createImpersonatedSession: ReturnType<typeof vi.fn>;
  mintExchangeCode: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
} {
  const findByIdForAdminOrThrow = vi.fn().mockResolvedValue(adminUser);
  const assertCanImpersonate = vi.fn();
  const userService = {
    findByIdForAdminOrThrow,
    assertCanImpersonate,
  } as unknown as UserService;

  const updateStatus = vi.fn().mockResolvedValue({ ...adminUser, status: UserStatusEnum.BLOCKED });
  const userAdminService = { updateStatus } as unknown as UserAdminService;

  const createImpersonatedSession = vi.fn().mockResolvedValue({
    tokens: { accessToken: 'access', refreshToken: 'refresh', expiresInSec: 3_600 },
    sessionId: 'session-imp-1',
  });
  const sessionService = { createImpersonatedSession } as unknown as SessionService;

  const mintExchangeCode = vi.fn().mockResolvedValue('exchange-code-1');
  const oauthFlowService = { mintExchangeCode } as unknown as OauthFlowService;

  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;

  return {
    controller: new UserAdminController(
      userService,
      userAdminService,
      sessionService,
      oauthFlowService,
      eventBus,
    ),
    findByIdForAdminOrThrow,
    assertCanImpersonate,
    updateStatus,
    createImpersonatedSession,
    mintExchangeCode,
    emit,
  };
}

function fakeRequest(): FastifyRequest {
  return { headers: { 'user-agent': 'vitest' }, ip: '127.0.0.1' } as unknown as FastifyRequest;
}

// The orchestration (existence check, self-block assert, fail-safe revoke
// ordering, event emission) now lives in UserAdminService — see
// user-admin.service.spec.ts. The controller only has delegation left to
// verify.
describe('UserAdminController.updateStatus', () => {
  it('delegates to UserAdminService.updateStatus and returns its result', async () => {
    const { controller, updateStatus } = createController();

    const result = await controller.updateStatus(adminId, userId, {
      status: UserStatusEnum.BLOCKED,
      reason: 'Repeated ToS violations',
    });

    expect(updateStatus).toHaveBeenCalledWith(
      adminId,
      userId,
      UserStatusEnum.BLOCKED,
      'Repeated ToS violations',
    );
    expect(result).toEqual({ ...adminUser, status: UserStatusEnum.BLOCKED });
  });
});

describe('UserAdminController.loginAs', () => {
  it('creates an impersonated session, mints an exchange code and emits admin.login-as', async () => {
    const { controller, createImpersonatedSession, mintExchangeCode, emit } = createController();

    const result = await controller.loginAs(adminId, userId, fakeRequest());

    expect(createImpersonatedSession).toHaveBeenCalledWith(
      adminUser,
      adminId,
      expect.objectContaining({ ip: '127.0.0.1' }),
    );
    expect(mintExchangeCode).toHaveBeenCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresInSec: 3_600,
    });
    expect(emit).toHaveBeenCalledWith('admin.login-as', {
      userId,
      actorId: adminId,
      sessionId: 'session-imp-1',
    });
    expect(result).toEqual({ code: 'exchange-code-1' });
  });

  it('aborts before creating a session when the role gate rejects the target', async () => {
    const { controller, assertCanImpersonate, createImpersonatedSession, mintExchangeCode, emit } =
      createController();

    assertCanImpersonate.mockImplementation((): void => {
      throw new ForbiddenError({ code: 'ADMIN_CANNOT_IMPERSONATE_ADMIN', details: 'nope' });
    });

    await expect(controller.loginAs(adminId, userId, fakeRequest())).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    expect(createImpersonatedSession).not.toHaveBeenCalled();
    expect(mintExchangeCode).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
