import { AccountSecurityListener } from '@modules/account-security/listeners/account-security.listener.js';
import type { LoginLockoutService } from '@modules/account-security/services/login-lockout.service.js';
import type { NewDeviceService } from '@modules/account-security/services/new-device.service.js';
import { describe, expect, it, vi } from 'vitest';

function createListener(): {
  listener: AccountSecurityListener;
  loginLockoutService: { [key: string]: ReturnType<typeof vi.fn> };
  newDeviceService: { [key: string]: ReturnType<typeof vi.fn> };
} {
  const loginLockoutService = {
    recordFailedLogin: vi.fn().mockResolvedValue(undefined),
    resetFailedAttempts: vi.fn().mockResolvedValue(undefined),
  };
  const newDeviceService = {
    sendAlert: vi.fn().mockResolvedValue(undefined),
  };
  const listener: AccountSecurityListener = new AccountSecurityListener(
    loginLockoutService as unknown as LoginLockoutService,
    newDeviceService as unknown as NewDeviceService,
  );

  return { listener, loginLockoutService, newDeviceService };
}

describe('AccountSecurityListener', () => {
  it('records a failed login on auth.login-failed', async () => {
    const { listener, loginLockoutService } = createListener();

    await listener.onAuthLoginFailed({ email: 'user@example.com', ip: '127.0.0.1' });

    expect(loginLockoutService.recordFailedLogin).toHaveBeenCalledWith(
      'user@example.com',
      '127.0.0.1',
    );
  });

  it('resets counters on auth.login', async () => {
    const { listener, loginLockoutService } = createListener();

    await listener.onAuthLogin({ userId: 'user-1', email: 'user@example.com', ip: '127.0.0.1' });

    expect(loginLockoutService.resetFailedAttempts).toHaveBeenCalledWith(
      'user@example.com',
      '127.0.0.1',
    );
  });

  it('sends a new-device alert on auth.new-device', async () => {
    const { listener, newDeviceService } = createListener();

    await listener.onAuthNewDevice({
      userId: 'user-1',
      ip: '127.0.0.1',
      device: 'Chrome on Fedora',
    });

    expect(newDeviceService.sendAlert).toHaveBeenCalledWith(
      'user-1',
      'Chrome on Fedora',
      '127.0.0.1',
    );
  });

  it('swallows a failure recording a failed login instead of throwing', async () => {
    const { listener, loginLockoutService } = createListener();

    loginLockoutService.recordFailedLogin.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      listener.onAuthLoginFailed({ email: 'user@example.com', ip: '127.0.0.1' }),
    ).resolves.toBeUndefined();
  });

  it('swallows a failure resetting counters instead of throwing', async () => {
    const { listener, loginLockoutService } = createListener();

    loginLockoutService.resetFailedAttempts.mockRejectedValue(new Error('redis unavailable'));

    await expect(
      listener.onAuthLogin({ userId: 'user-1', email: 'user@example.com', ip: '127.0.0.1' }),
    ).resolves.toBeUndefined();
  });

  it('swallows a failure sending the new-device alert instead of throwing', async () => {
    const { listener, newDeviceService } = createListener();

    newDeviceService.sendAlert.mockRejectedValue(new Error('mail transport unavailable'));

    await expect(
      listener.onAuthNewDevice({ userId: 'user-1', ip: '127.0.0.1', device: 'Chrome on Fedora' }),
    ).resolves.toBeUndefined();
  });
});
