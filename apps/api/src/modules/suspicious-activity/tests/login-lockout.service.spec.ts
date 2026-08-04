import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { FAILED_LOGIN_THRESHOLD } from '@modules/suspicious-activity/constants/suspicious-activity.constants.js';
import type { LockoutRepositoryInterface } from '@modules/suspicious-activity/interfaces/lockout-repository.interface.js';
import { LoginLockoutService } from '@modules/suspicious-activity/services/login-lockout.service.js';
import { LockoutScopeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

interface TestSetupInterface {
  readonly service: LoginLockoutService;
  readonly repository: { [key: string]: ReturnType<typeof vi.fn> };
  readonly eventBus: { emit: ReturnType<typeof vi.fn> };
}

function createService(): TestSetupInterface {
  const repository = {
    incrementFailedAttempts: vi.fn().mockResolvedValue(1),
    isLocked: vi.fn().mockResolvedValue(false),
    lock: vi.fn().mockResolvedValue(true),
    resetFailedAttempts: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    findAllLockouts: vi.fn().mockResolvedValue([]),
  };
  const eventBus = { emit: vi.fn() };

  const service: LoginLockoutService = new LoginLockoutService(
    repository as unknown as LockoutRepositoryInterface,
    eventBus as unknown as EventBusService,
  );

  return { service, repository, eventBus };
}

describe('LoginLockoutService', () => {
  describe('assertNotLocked', () => {
    it('resolves when neither email nor ip is locked', async () => {
      const setup = createService();

      await expect(
        setup.service.assertNotLocked('user@example.com', '127.0.0.1'),
      ).resolves.toBeUndefined();
    });

    it('throws AUTH_TEMPORARILY_LOCKED when the email is locked', async () => {
      const setup = createService();

      setup.repository.isLocked.mockImplementation(
        async (scope: LockoutScopeEnum): Promise<boolean> => scope === LockoutScopeEnum.EMAIL,
      );

      const error = await setup.service
        .assertNotLocked('user@example.com', '127.0.0.1')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(UnauthorizedError);
      expect((error as UnauthorizedError).args.code).toBe('AUTH_TEMPORARILY_LOCKED');
    });

    it('throws AUTH_TEMPORARILY_LOCKED when the ip is locked', async () => {
      const setup = createService();

      setup.repository.isLocked.mockImplementation(
        async (scope: LockoutScopeEnum): Promise<boolean> => scope === LockoutScopeEnum.IP,
      );

      await expect(
        setup.service.assertNotLocked('user@example.com', '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('fails open when the repository throws', async () => {
      const setup = createService();

      setup.repository.isLocked.mockRejectedValue(new Error('redis unavailable'));

      await expect(
        setup.service.assertNotLocked('user@example.com', '127.0.0.1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('recordFailedLogin', () => {
    it('increments both scopes and does not lock below the threshold', async () => {
      const setup = createService();

      setup.repository.incrementFailedAttempts.mockResolvedValue(FAILED_LOGIN_THRESHOLD - 1);

      await setup.service.recordFailedLogin('user@example.com', '127.0.0.1');

      expect(setup.repository.incrementFailedAttempts).toHaveBeenCalledWith(
        LockoutScopeEnum.EMAIL,
        'user@example.com',
      );
      expect(setup.repository.incrementFailedAttempts).toHaveBeenCalledWith(
        LockoutScopeEnum.IP,
        '127.0.0.1',
      );
      expect(setup.repository.lock).not.toHaveBeenCalled();
    });

    it('locks and emits auth.suspicious-login once the threshold is reached', async () => {
      const setup = createService();

      setup.repository.incrementFailedAttempts.mockResolvedValue(FAILED_LOGIN_THRESHOLD);

      await setup.service.recordFailedLogin('user@example.com', '127.0.0.1');

      expect(setup.eventBus.emit).toHaveBeenCalledWith('auth.suspicious-login', {
        scope: LockoutScopeEnum.EMAIL,
        value: 'user@example.com',
      });
      expect(setup.eventBus.emit).toHaveBeenCalledWith('auth.suspicious-login', {
        scope: LockoutScopeEnum.IP,
        value: '127.0.0.1',
      });
    });

    it('does not re-emit when the lockout was already set (SET NX no-op)', async () => {
      const setup = createService();

      setup.repository.incrementFailedAttempts.mockResolvedValue(FAILED_LOGIN_THRESHOLD + 1);
      setup.repository.lock.mockResolvedValue(false);

      await setup.service.recordFailedLogin('user@example.com', '127.0.0.1');

      expect(setup.eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('resetFailedAttempts', () => {
    it('resets both scopes', async () => {
      const setup = createService();

      await setup.service.resetFailedAttempts('user@example.com', '127.0.0.1');

      expect(setup.repository.resetFailedAttempts).toHaveBeenCalledWith(
        LockoutScopeEnum.EMAIL,
        'user@example.com',
      );
      expect(setup.repository.resetFailedAttempts).toHaveBeenCalledWith(
        LockoutScopeEnum.IP,
        '127.0.0.1',
      );
    });
  });

  describe('listLockouts / release', () => {
    it('adds an opaque base64url key derived from scope and value', async () => {
      const setup = createService();

      setup.repository.findAllLockouts.mockResolvedValue([
        { scope: LockoutScopeEnum.EMAIL, value: 'user@example.com', ttlSec: 500 },
      ]);

      const [lockout] = await setup.service.listLockouts();

      expect(lockout?.key).toBe(Buffer.from('EMAIL:user@example.com').toString('base64url'));
    });

    it('round-trips a key through release back to scope and value', async () => {
      const setup = createService();
      const key: string = Buffer.from('IP:203.0.113.7').toString('base64url');

      await setup.service.release(key);

      expect(setup.repository.release).toHaveBeenCalledWith(LockoutScopeEnum.IP, '203.0.113.7');
    });

    it('keeps colons in an ipv6 value intact when decoding a key', async () => {
      const setup = createService();
      const key: string = Buffer.from('IP:2001:db8::1').toString('base64url');

      await setup.service.release(key);

      expect(setup.repository.release).toHaveBeenCalledWith(LockoutScopeEnum.IP, '2001:db8::1');
    });
  });
});
