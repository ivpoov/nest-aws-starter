import { ActivityListener } from '@modules/activity/listeners/activity.listener.js';
import type { ActivityService } from '@modules/activity/services/activity.service.js';
import { ActivityTypeEnum, AuthMethodTypeEnum, LockoutScopeEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

function createListener(): { listener: ActivityListener; record: ReturnType<typeof vi.fn> } {
  const record = vi.fn().mockResolvedValue(undefined);
  const activityService = { record } as unknown as ActivityService;
  const listener: ActivityListener = new ActivityListener(activityService);

  return { listener, record };
}

const userId = '01890a5d-0000-774b-bcce-b30209990001';
const sessionId = '01890a5d-0000-774b-bcce-b30209990002';

describe('ActivityListener', () => {
  it('records USER_REGISTERED on user.registered', async () => {
    const { listener, record } = createListener();

    await listener.onUserRegistered({ userId, ip: '127.0.0.1' });

    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.USER_REGISTERED,
      ip: '127.0.0.1',
    });
  });

  it('records USER_OAUTH_REGISTERED on user.oauth-registered', async () => {
    const { listener, record } = createListener();

    await listener.onUserOauthRegistered({ userId, avatarUrl: null });

    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.USER_OAUTH_REGISTERED,
    });
  });

  it('records AUTH_LOGIN on auth.login', async () => {
    const { listener, record } = createListener();

    await listener.onAuthLogin({ userId, ip: '127.0.0.1' });

    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.AUTH_LOGIN,
      ip: '127.0.0.1',
    });
  });

  it('records AUTH_LOGIN_FAILED on auth.login-failed', async () => {
    const { listener, record } = createListener();

    await listener.onAuthLoginFailed({ email: 'user@example.com', ip: '127.0.0.1' });

    expect(record).toHaveBeenCalledWith({
      type: ActivityTypeEnum.AUTH_LOGIN_FAILED,
      ip: '127.0.0.1',
      meta: { email: 'user@example.com' },
    });
  });

  it('records AUTH_LOGOUT on auth.logout', async () => {
    const { listener, record } = createListener();

    await listener.onAuthLogout({ userId, sessionId });

    expect(record).toHaveBeenCalledWith({
      userId,
      sessionId,
      type: ActivityTypeEnum.AUTH_LOGOUT,
    });
  });

  it('records AUTH_PASSWORD_CHANGED on auth.password-changed', async () => {
    const { listener, record } = createListener();

    await listener.onAuthPasswordChanged({ userId, sessionId: null });

    expect(record).toHaveBeenCalledWith({
      userId,
      sessionId: null,
      type: ActivityTypeEnum.AUTH_PASSWORD_CHANGED,
    });
  });

  it('records AUTH_METHOD_LINKED on auth.method-linked', async () => {
    const { listener, record } = createListener();

    await listener.onAuthMethodLinked({ userId, type: AuthMethodTypeEnum.GOOGLE });

    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.AUTH_METHOD_LINKED,
      meta: { methodType: AuthMethodTypeEnum.GOOGLE },
    });
  });

  it('records AUTH_METHOD_UNLINKED on auth.method-unlinked', async () => {
    const { listener, record } = createListener();

    await listener.onAuthMethodUnlinked({ userId, type: AuthMethodTypeEnum.EMAIL });

    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.AUTH_METHOD_UNLINKED,
      meta: { methodType: AuthMethodTypeEnum.EMAIL },
    });
  });

  it('records USER_BLOCKED on user.blocked with no meta when no reason was given', async () => {
    const { listener, record } = createListener();

    await listener.onUserBlocked({ userId, actorId: sessionId });

    expect(record).toHaveBeenCalledWith({
      userId,
      actorId: sessionId,
      type: ActivityTypeEnum.USER_BLOCKED,
      meta: undefined,
    });
  });

  it('records USER_BLOCKED with the reason in meta when the admin provided one', async () => {
    const { listener, record } = createListener();

    await listener.onUserBlocked({
      userId,
      actorId: sessionId,
      reason: 'Repeated ToS violations',
    });

    expect(record).toHaveBeenCalledWith({
      userId,
      actorId: sessionId,
      type: ActivityTypeEnum.USER_BLOCKED,
      meta: { reason: 'Repeated ToS violations' },
    });
  });

  it('records USER_UNBLOCKED on user.unblocked with no meta when no reason was given', async () => {
    const { listener, record } = createListener();

    await listener.onUserUnblocked({ userId, actorId: sessionId });

    expect(record).toHaveBeenCalledWith({
      userId,
      actorId: sessionId,
      type: ActivityTypeEnum.USER_UNBLOCKED,
      meta: undefined,
    });
  });

  it('records USER_UNBLOCKED with the reason in meta when the admin provided one', async () => {
    const { listener, record } = createListener();

    await listener.onUserUnblocked({ userId, actorId: sessionId, reason: 'False positive' });

    expect(record).toHaveBeenCalledWith({
      userId,
      actorId: sessionId,
      type: ActivityTypeEnum.USER_UNBLOCKED,
      meta: { reason: 'False positive' },
    });
  });

  it('records AUTH_SUSPICIOUS_LOGIN on auth.suspicious-login for an ip breach', async () => {
    const { listener, record } = createListener();

    await listener.onAuthSuspiciousLogin({ scope: LockoutScopeEnum.IP, value: '127.0.0.1' });

    expect(record).toHaveBeenCalledWith({
      type: ActivityTypeEnum.AUTH_SUSPICIOUS_LOGIN,
      ip: '127.0.0.1',
      meta: { scope: LockoutScopeEnum.IP, value: '127.0.0.1' },
    });
  });

  it('records AUTH_SUSPICIOUS_LOGIN on auth.suspicious-login for an email breach', async () => {
    const { listener, record } = createListener();

    await listener.onAuthSuspiciousLogin({
      scope: LockoutScopeEnum.EMAIL,
      value: 'user@example.com',
    });

    expect(record).toHaveBeenCalledWith({
      type: ActivityTypeEnum.AUTH_SUSPICIOUS_LOGIN,
      ip: null,
      meta: { scope: LockoutScopeEnum.EMAIL, value: 'user@example.com' },
    });
  });

  it('records AUTH_NEW_DEVICE on auth.new-device', async () => {
    const { listener, record } = createListener();

    await listener.onAuthNewDevice({ userId, ip: '127.0.0.1', device: 'Chrome on Fedora' });

    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.AUTH_NEW_DEVICE,
      ip: '127.0.0.1',
      meta: { device: 'Chrome on Fedora' },
    });
  });

  it('records ADMIN_LOGIN_AS on admin.login-as', async () => {
    const { listener, record } = createListener();
    const adminId = '01890a5d-0000-774b-bcce-b30209990003';

    await listener.onAdminLoginAs({ userId, actorId: adminId, sessionId });

    expect(record).toHaveBeenCalledWith({
      userId,
      actorId: adminId,
      sessionId,
      type: ActivityTypeEnum.ADMIN_LOGIN_AS,
    });
  });

  it('swallows a repository failure instead of producing an unhandled rejection', async () => {
    const record = vi.fn().mockRejectedValue(new Error('activity table unavailable'));
    const activityService = { record } as unknown as ActivityService;
    const listener: ActivityListener = new ActivityListener(activityService);

    // EventBusService.emit() never awaits its listeners — if this handler's
    // promise rejected, it would surface as an unhandled rejection on the
    // login path instead of resolving quietly here.
    await expect(listener.onAuthLogin({ userId, ip: '127.0.0.1' })).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledWith({
      userId,
      type: ActivityTypeEnum.AUTH_LOGIN,
      ip: '127.0.0.1',
    });
  });
});
