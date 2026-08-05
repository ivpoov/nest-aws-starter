import type { MailConfig } from '@configs/mail.config.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NotificationEmailService } from '@modules/notification/services/notification-email.service.js';
import type { NotificationPreferenceService } from '@modules/notification/services/notification-preference.service.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum, NotificationTypeEnum } from '@nest-aws-starter/shared';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const userId = '01890a5d-0000-774b-bcce-b30209990001';

function createEmailMethod(email: string | null): AuthMethodInterface | null {
  if (!email) return null;

  return {
    id: 'method-1',
    userId,
    type: AuthMethodTypeEnum.EMAIL,
    email,
    isEmailVerified: true,
    passwordHash: 'hash',
    providerAccountId: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    lastUsedAt: null,
  };
}

interface TestSetupInterface {
  readonly service: NotificationEmailService;
  readonly send: ReturnType<typeof vi.fn>;
  readonly isEmailEnabled: ReturnType<typeof vi.fn>;
  readonly findEmailMethodByUserId: ReturnType<typeof vi.fn>;
}

function createService(
  overrides: { isEnabled?: boolean; isEmailEnabled?: boolean; email?: string | null } = {},
): TestSetupInterface {
  const email: string | null =
    'email' in overrides ? (overrides.email ?? null) : 'user@example.com';
  const config = { isEnabled: overrides.isEnabled ?? true } as unknown as MailConfig;
  const send = vi.fn().mockResolvedValue(undefined);
  const mailTransport = { send } as unknown as MailTransportInterface;
  const isEmailEnabled = vi.fn().mockResolvedValue(overrides.isEmailEnabled ?? true);
  const preferenceService = { isEmailEnabled } as unknown as NotificationPreferenceService;
  const findEmailMethodByUserId = vi.fn().mockResolvedValue(createEmailMethod(email));
  const userService = { findEmailMethodByUserId } as unknown as UserService;
  const service = new NotificationEmailService(
    config,
    mailTransport,
    preferenceService,
    userService,
  );

  return { service, send, isEmailEnabled, findEmailMethodByUserId };
}

describe('NotificationEmailService.sendIfEnabled', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(CustomLoggerService.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the mail when mail is enabled, the preference is on, and a verified email exists', async () => {
    const { service, send } = createService();

    await service.sendIfEnabled(userId, NotificationTypeEnum.PASSWORD_CHANGED, 'title', 'body');

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@example.com', subject: 'title' }),
    );
  });

  it('skips with a debug log when mail is globally disabled — no error', async () => {
    const { service, send, isEmailEnabled } = createService({ isEnabled: false });

    await expect(
      service.sendIfEnabled(userId, NotificationTypeEnum.PASSWORD_CHANGED, 'title', 'body'),
    ).resolves.toBeUndefined();

    expect(send).not.toHaveBeenCalled();
    expect(isEmailEnabled).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });

  it('skips when the user has disabled EMAIL for this type', async () => {
    const { service, send } = createService({ isEmailEnabled: false });

    await service.sendIfEnabled(userId, NotificationTypeEnum.PASSWORD_CHANGED, 'title', 'body');

    expect(send).not.toHaveBeenCalled();
  });

  it('skips when the recipient has no email method', async () => {
    const { service, send } = createService({ email: null });

    await service.sendIfEnabled(userId, NotificationTypeEnum.PASSWORD_CHANGED, 'title', 'body');

    expect(send).not.toHaveBeenCalled();
  });
});
