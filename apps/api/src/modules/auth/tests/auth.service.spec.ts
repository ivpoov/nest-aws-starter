import { ARGON2_OPTIONS } from '@modules/auth/constants/auth.constants.js';
import type { LoginDto } from '@modules/auth/dtos/login.dto.js';
import { AuthService } from '@modules/auth/services/auth.service.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import type { NewDeviceCheckInterface } from '@modules/suspicious-activity/interfaces/new-device-check.interface.js';
import type { LoginLockoutService } from '@modules/suspicious-activity/services/login-lockout.service.js';
import type { NewDeviceService } from '@modules/suspicious-activity/services/new-device.service.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum, UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { hash } from 'argon2';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const user: UserInterface = {
  id: 'user-1',
  displayName: 'Igor',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const context: SessionContextInterface = { userAgent: null, ip: '127.0.0.1' };
const dto: LoginDto = { email: 'igor@example.com', password: 'correct-horse-battery' };

let method: AuthMethodInterface;

interface TestSetupInterface {
  readonly service: AuthService;
  readonly userService: { [key: string]: ReturnType<typeof vi.fn> };
  readonly sessionService: { createSession: ReturnType<typeof vi.fn> };
  readonly loginLockoutService: { [key: string]: ReturnType<typeof vi.fn> };
  readonly newDeviceService: { [key: string]: ReturnType<typeof vi.fn> };
  readonly eventBus: { emit: ReturnType<typeof vi.fn> };
}

function createService(): TestSetupInterface {
  const userService = {
    findEmailMethod: vi.fn().mockResolvedValue(method),
    findByIdOrThrow: vi.fn().mockResolvedValue(user),
    touchMethodLastUsed: vi.fn().mockResolvedValue(undefined),
  };
  const sessionService = {
    createSession: vi
      .fn()
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresInSec: 900 }),
  };
  const loginLockoutService = {
    assertNotLocked: vi.fn().mockResolvedValue(undefined),
  };
  const newDeviceService = {
    check: vi.fn().mockResolvedValue({ isNewDevice: false, device: 'Chrome on Fedora' }),
  };
  const eventBus = { emit: vi.fn() };

  const service: AuthService = new AuthService(
    userService as unknown as UserService,
    sessionService as unknown as SessionService,
    loginLockoutService as unknown as LoginLockoutService,
    newDeviceService as unknown as NewDeviceService,
    eventBus as unknown as EventBusService,
  );

  return { service, userService, sessionService, loginLockoutService, newDeviceService, eventBus };
}

describe('AuthService login', () => {
  beforeAll(async () => {
    method = {
      id: 'method-1',
      userId: user.id,
      type: AuthMethodTypeEnum.EMAIL,
      email: dto.email,
      isEmailVerified: true,
      passwordHash: await hash(dto.password, ARGON2_OPTIONS),
      providerAccountId: null,
      createdAt: new Date(),
      lastUsedAt: null,
    };
  });

  it('checks the lockout before touching credentials', async () => {
    const setup = createService();
    const order: string[] = [];

    setup.loginLockoutService.assertNotLocked.mockImplementation(async (): Promise<void> => {
      order.push('assertNotLocked');
    });
    setup.userService.findEmailMethod.mockImplementation(async (): Promise<AuthMethodInterface> => {
      order.push('findEmailMethod');

      return method;
    });

    await setup.service.login(dto, context);

    expect(order).toEqual(['assertNotLocked', 'findEmailMethod']);
  });

  it('never verifies credentials while locked', async () => {
    const setup = createService();

    setup.loginLockoutService.assertNotLocked.mockRejectedValue(
      new UnauthorizedError({ code: 'AUTH_TEMPORARILY_LOCKED', details: 'locked' }),
    );

    await expect(setup.service.login(dto, context)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(setup.userService.findEmailMethod).not.toHaveBeenCalled();
  });

  it('checks for a new device before creating the session, not after', async () => {
    const setup = createService();
    const order: string[] = [];

    setup.newDeviceService.check.mockImplementation(async (): Promise<NewDeviceCheckInterface> => {
      order.push('check');

      return { isNewDevice: false, device: 'Chrome on Fedora' };
    });
    setup.sessionService.createSession.mockImplementation(async () => {
      order.push('createSession');

      return { accessToken: 'a', refreshToken: 'r', expiresInSec: 900 };
    });

    await setup.service.login(dto, context);

    expect(order).toEqual(['check', 'createSession']);
  });

  it('emits auth.login with the email so the counter listener can reset it', async () => {
    const setup = createService();

    await setup.service.login(dto, context);

    expect(setup.eventBus.emit).toHaveBeenCalledWith('auth.login', {
      userId: user.id,
      email: dto.email,
      ip: context.ip,
    });
  });

  it('emits auth.new-device when the device check reports a first-seen device', async () => {
    const setup = createService();

    setup.newDeviceService.check.mockResolvedValue({
      isNewDevice: true,
      device: 'Firefox on Windows',
    });

    await setup.service.login(dto, context);

    expect(setup.eventBus.emit).toHaveBeenCalledWith('auth.new-device', {
      userId: user.id,
      ip: context.ip,
      device: 'Firefox on Windows',
    });
  });

  it('does not emit auth.new-device for a known device', async () => {
    const setup = createService();

    await setup.service.login(dto, context);

    expect(setup.eventBus.emit).not.toHaveBeenCalledWith('auth.new-device', expect.anything());
  });
});
