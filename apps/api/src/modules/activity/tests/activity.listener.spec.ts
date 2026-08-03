import { ActivityListener } from '@modules/activity/listeners/activity.listener.js';
import type { ActivityService } from '@modules/activity/services/activity.service.js';
import { ActivityTypeEnum, AuthMethodTypeEnum } from '@nest-aws-starter/shared';
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
});
