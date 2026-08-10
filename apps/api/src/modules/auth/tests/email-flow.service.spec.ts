import type { WebAppConfig } from '@configs/web-app.config.js';
import { OneTimeTokenKindEnum } from '@modules/auth/enums/one-time-token-kind.enum.js';
import type { OneTimeTokenRepositoryInterface } from '@modules/auth/interfaces/one-time-token-repository.interface.js';
import { EmailFlowService } from '@modules/auth/services/email-flow.service.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import type { SessionService } from '@modules/session/services/session.service.js';
import type { AuthMethodInterface } from '@modules/user/interfaces/auth-method.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { MailTransportInterface } from '@providers/mail/interfaces/mail-transport.interface.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// argon2 is a native ESM module whose exports cannot be spied on in place, and
// a real hash costs ~100ms per call — neither helps prove write ORDERING, which
// is all these specs are about.
vi.mock('argon2', () => ({
  argon2id: 2,
  hash: vi.fn(async (): Promise<string> => 'new-hash'),
  verify: vi.fn(
    async (_stored: string, plain: string): Promise<boolean> => plain === 'current-password',
  ),
}));

const config: WebAppConfig = { baseUrl: 'https://app.example.com' } as WebAppConfig;

function emailMethod(): AuthMethodInterface {
  return {
    id: 'method-1',
    userId: 'user-1',
    type: AuthMethodTypeEnum.EMAIL,
    email: 'user@example.com',
    isEmailVerified: true,
    // Opaque placeholder — the stubbed `verify` above decides the outcome from
    // the plaintext argument, so this is never a real credential.
    passwordHash: 'stored-hash',
    providerAccountId: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    lastUsedAt: null,
  };
}

interface SetupInterface {
  readonly service: EmailFlowService;
  readonly tokenRepository: OneTimeTokenRepositoryInterface;
  readonly users: { updatePasswordHash: ReturnType<typeof vi.fn> };
  readonly sessions: {
    revokeAllForUser: ReturnType<typeof vi.fn>;
    revokeOtherSessions: ReturnType<typeof vi.fn>;
  };
  readonly calls: string[];
}

function setup(): SetupInterface {
  // One shared log, so a spec can assert the ORDER of two writes across two
  // different collaborators — the whole point of the fail-safe sequencing.
  const calls: string[] = [];
  const tokenRepository: OneTimeTokenRepositoryInterface = {
    setToken: vi.fn().mockResolvedValue(undefined),
    consumeToken: vi.fn().mockResolvedValue('valid-token'),
  };
  const users = {
    findEmailMethodByUserId: vi.fn().mockResolvedValue(emailMethod()),
    findEmailMethod: vi.fn().mockResolvedValue(emailMethod()),
    markEmailVerified: vi.fn().mockResolvedValue(undefined),
    updatePasswordHash: vi.fn(async (): Promise<void> => {
      calls.push('updatePasswordHash');
    }),
  };
  const sessions = {
    revokeAllForUser: vi.fn(async (): Promise<number> => {
      calls.push('revokeAllForUser');

      return 2;
    }),
    revokeOtherSessions: vi.fn(async (): Promise<number> => {
      calls.push('revokeOtherSessions');

      return 1;
    }),
  };
  const mailTransport: MailTransportInterface = {
    send: vi.fn().mockResolvedValue(undefined),
  } as unknown as MailTransportInterface;
  const eventBus = { emit: vi.fn() } as unknown as EventBusService;
  const service: EmailFlowService = new EmailFlowService(
    config,
    tokenRepository,
    mailTransport,
    users as unknown as UserService,
    sessions as unknown as SessionService,
    eventBus,
  );

  return { service, tokenRepository, users, sessions, calls };
}

describe('EmailFlowService.resetPassword', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('consumes the one-time token before touching the password', async () => {
    const { service, tokenRepository, users } = setup();
    vi.mocked(tokenRepository.consumeToken).mockResolvedValue(null);

    await expect(service.resetPassword('user-1', 'valid-token', 'new-password')).rejects.toThrow(
      UnauthorizedError,
    );
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  // Fail-safe ordering: the session store is Redis-backed and cannot join the
  // database unit of work, so the only lever is the order. Revoking after the
  // password write would leave a crash window where the NEW password is live
  // and every pre-reset session — including an attacker's — is still valid.
  it('revokes every session BEFORE writing the new password hash', async () => {
    const { service, calls } = setup();

    await service.resetPassword('user-1', 'valid-token', 'new-password');

    expect(calls).toEqual(['revokeAllForUser', 'updatePasswordHash']);
  });

  it('leaves the old password in force when the revoke fails', async () => {
    const { service, sessions, users } = setup();
    sessions.revokeAllForUser.mockRejectedValue(new Error('redis unreachable'));

    await expect(service.resetPassword('user-1', 'valid-token', 'new-password')).rejects.toThrow(
      'redis unreachable',
    );
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('has already revoked the sessions when the password write fails', async () => {
    const { service, sessions, users } = setup();
    users.updatePasswordHash.mockRejectedValue(new Error('database down'));

    await expect(service.resetPassword('user-1', 'valid-token', 'new-password')).rejects.toThrow(
      'database down',
    );
    // Revoked early, not left valid — the safe direction of the failure.
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1');
  });
});

describe('EmailFlowService.changePassword', () => {
  it('revokes the other sessions BEFORE writing the new password hash', async () => {
    const { service, calls } = setup();

    await service.changePassword('user-1', 'session-1', 'current-password', 'new-password');

    expect(calls).toEqual(['revokeOtherSessions', 'updatePasswordHash']);
  });

  it('has already revoked the other sessions when the password write fails', async () => {
    const { service, sessions, users } = setup();
    users.updatePasswordHash.mockRejectedValue(new Error('database down'));

    await expect(
      service.changePassword('user-1', 'session-1', 'current-password', 'new-password'),
    ).rejects.toThrow('database down');
    expect(sessions.revokeOtherSessions).toHaveBeenCalledWith('user-1', 'session-1');
  });

  it('writes nothing when the current password does not verify', async () => {
    const { service, sessions, users } = setup();

    await expect(
      service.changePassword('user-1', 'session-1', 'wrong-password', 'new-password'),
    ).rejects.toThrow(UnauthorizedError);
    expect(sessions.revokeOtherSessions).not.toHaveBeenCalled();
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });
});

describe('EmailFlowService.verifyEmail', () => {
  it('rejects an unknown token kind mismatch without marking the address verified', async () => {
    const { service, tokenRepository } = setup();
    vi.mocked(tokenRepository.consumeToken).mockResolvedValue('a-different-token');

    await expect(service.verifyEmail('user-1', 'valid-token')).rejects.toThrow(UnauthorizedError);
    expect(tokenRepository.consumeToken).toHaveBeenCalledWith(
      'user-1',
      OneTimeTokenKindEnum.VERIFY_EMAIL,
    );
  });
});
