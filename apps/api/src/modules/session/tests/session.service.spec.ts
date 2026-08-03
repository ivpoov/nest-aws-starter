import type { AuthConfig } from '@configs/auth.config.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { CreateSessionDataInterface } from '@modules/session/interfaces/create-session-data.interface.js';
import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';
import type { SessionRepositoryInterface } from '@modules/session/interfaces/session-repository.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { TokenService } from '@modules/token/services/token.service.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserService } from '@modules/user/services/user.service.js';
import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const config: AuthConfig = {
  jwtSecret: 'unit-test-secret-with-at-least-32-characters',
  accessTtlSec: 900,
  refreshTtlSec: 2_592_000,
  refreshGraceSec: 30,
};

const user: UserInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  displayName: 'Igor',
  role: UserRoleEnum.USER,
  status: UserStatusEnum.ACTIVE,
  avatarKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// In-memory allowlist implementing the token repository contract — the rotation
// algorithm is exercised against real key semantics, no Redis needed.
class FakeTokenRepository implements TokenRepositoryInterface {
  public readonly keys: Map<string, string> = new Map();

  public async setAccessToken(userId: string, sessionId: string, token: string): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:access`, token);
  }

  public async setRefreshToken(userId: string, sessionId: string, token: string): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:refresh`, token);
  }

  public async setPreviousRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:prev`, token);
  }

  public async getAccessToken(userId: string, sessionId: string): Promise<string | null> {
    return this.keys.get(`${userId}:${sessionId}:access`) ?? null;
  }

  public async getRefreshToken(userId: string, sessionId: string): Promise<string | null> {
    return this.keys.get(`${userId}:${sessionId}:refresh`) ?? null;
  }

  public async getPreviousRefreshToken(userId: string, sessionId: string): Promise<string | null> {
    return this.keys.get(`${userId}:${sessionId}:prev`) ?? null;
  }

  public async deleteAllForSession(userId: string, sessionId: string): Promise<void> {
    for (const suffix of ['access', 'refresh', 'prev']) {
      this.keys.delete(`${userId}:${sessionId}:${suffix}`);
    }
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    for (const key of this.keys.keys()) {
      if (key.startsWith(`${userId}:`)) this.keys.delete(key);
    }
  }
}

class FakeSessionRepository implements SessionRepositoryInterface {
  public readonly sessions: Map<string, SessionInterface> = new Map();
  private counter = 0;

  public async create(data: CreateSessionDataInterface): Promise<SessionInterface> {
    this.counter += 1;

    const session: SessionInterface = {
      id: `session-${this.counter}`,
      userId: data.userId,
      device: data.device,
      ip: data.ip,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      activeUntil: data.activeUntil,
      signedAsAdminId: data.signedAsAdminId ?? null,
    };

    this.sessions.set(session.id, session);

    return session;
  }

  public async findById(id: string): Promise<SessionInterface | null> {
    return this.sessions.get(id) ?? null;
  }

  public async findActiveByUserId(userId: string, now: Date): Promise<SessionInterface[]> {
    return [...this.sessions.values()].filter(
      (session: SessionInterface): boolean =>
        session.userId === userId && session.activeUntil.getTime() > now.getTime(),
    );
  }

  public async touchLastActive(id: string, now: Date): Promise<void> {
    const session: SessionInterface | undefined = this.sessions.get(id);

    if (session) this.sessions.set(id, { ...session, lastActiveAt: now });
  }

  public async setActiveUntil(id: string, activeUntil: Date): Promise<boolean> {
    const session: SessionInterface | undefined = this.sessions.get(id);

    if (!session) return false;

    this.sessions.set(id, { ...session, activeUntil });

    return true;
  }

  public async endAllByUserId(userId: string, now: Date): Promise<number> {
    const active: SessionInterface[] = await this.findActiveByUserId(userId, now);

    for (const session of active) {
      this.sessions.set(session.id, { ...session, activeUntil: now });
    }

    return active.length;
  }
}

interface TestSetupInterface {
  readonly service: SessionService;
  readonly tokens: FakeTokenRepository;
  readonly sessions: FakeSessionRepository;
}

function createService(): TestSetupInterface {
  const tokens: FakeTokenRepository = new FakeTokenRepository();
  const sessions: FakeSessionRepository = new FakeSessionRepository();
  const tokenService: TokenService = new TokenService(config, tokens);
  const userService = {
    findByIdOrThrow: vi.fn().mockResolvedValue(user),
  } as unknown as UserService;
  const service: SessionService = new SessionService(
    config,
    sessions,
    tokens,
    tokenService,
    userService,
  );

  return { service, tokens, sessions };
}

const context = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/141.0', ip: '127.0.0.1' };

describe('SessionService rotation', () => {
  it('rotates happily: new pair issued, old token becomes the grace key', async () => {
    const { service, tokens } = createService();
    const first = await service.createSession(user, context);

    const second = await service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(tokens.keys.get(`${user.id}:session-1:refresh`)).toBe(second.refreshToken);
    expect(tokens.keys.get(`${user.id}:session-1:prev`)).toBe(first.refreshToken);
  });

  it('replays the current pair idempotently for a concurrent refresh inside grace', async () => {
    const { service } = createService();
    const first = await service.createSession(user, context);
    const second = await service.refresh(first.refreshToken);

    const replayed = await service.refresh(first.refreshToken);

    expect(replayed.refreshToken).toBe(second.refreshToken);
    expect(replayed.accessToken).toBe(second.accessToken);
  });

  it('revokes the session when a stale token is reused outside the grace window', async () => {
    const { service, tokens, sessions } = createService();
    const first = await service.createSession(user, context);

    await service.refresh(first.refreshToken);
    tokens.keys.delete(`${user.id}:session-1:prev`); // grace TTL elapsed

    await expect(service.refresh(first.refreshToken)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'AUTH_REFRESH_INVALID',
    );
    expect(tokens.keys.has(`${user.id}:session-1:refresh`)).toBe(false);
    expect((await sessions.findById('session-1'))?.activeUntil.getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it('reports an expired session distinctly', async () => {
    const { service, tokens, sessions } = createService();
    const first = await service.createSession(user, context);

    await sessions.setActiveUntil('session-1', new Date(Date.now() - 1000));
    tokens.keys.delete(`${user.id}:session-1:refresh`); // refresh key TTL elapsed

    await expect(service.refresh(first.refreshToken)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'AUTH_SESSION_EXPIRED',
    );
  });

  it('rejects garbage refresh tokens without touching anything', async () => {
    const { service } = createService();

    await expect(service.refresh('not-a-jwt')).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'AUTH_TOKEN_INVALID',
    );
  });
});

describe('SessionService management', () => {
  it('lists active sessions with the current one flagged', async () => {
    const { service } = createService();

    await service.createSession(user, context);
    await service.createSession(user, context);

    const list = await service.listSessions(user.id, 'session-2');

    expect(list).toHaveLength(2);
    expect(list.find((session) => session.id === 'session-2')?.isCurrent).toBe(true);
    expect(list.find((session) => session.id === 'session-1')?.isCurrent).toBe(false);
  });

  it('refuses to revoke a foreign session', async () => {
    const { service, sessions } = createService();

    await service.createSession(user, context);

    const existing: SessionInterface | null = await sessions.findById('session-1');

    if (!existing) throw new Error('fixture session missing');

    sessions.sessions.set('session-1', { ...existing, userId: 'someone-else' });

    await expect(service.revokeSession(user.id, 'session-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('revokes all sessions for a user, killing every allowlist key', async () => {
    const { service, tokens } = createService();

    await service.createSession(user, context);
    await service.createSession(user, context);

    const count: number = await service.revokeAllForUser(user.id);

    expect(count).toBe(2);
    expect([...tokens.keys.keys()].filter((key) => key.startsWith(`${user.id}:`))).toHaveLength(0);
  });
});

describe('SessionService impersonation', () => {
  const adminId = '01890a5d-ac96-774b-bcce-b302099a9999';

  it('mints a session flagged as impersonated with a 1h activeUntil', async () => {
    const { service, sessions } = createService();

    const result = await service.createImpersonatedSession(user, adminId, context);

    const session = await sessions.findById(result.sessionId);

    expect(session?.signedAsAdminId).toBe(adminId);
    expect(session?.activeUntil.getTime()).toBeLessThanOrEqual(Date.now() + 3_600_000);
    expect(session?.activeUntil.getTime()).toBeGreaterThan(Date.now() + 3_500_000);
  });

  it('carries actAsBy in the issued access token', async () => {
    const { service, tokens } = createService();

    const result = await service.createImpersonatedSession(user, adminId, context);
    const tokenService: TokenService = new TokenService(config, tokens);
    const currentUser = await tokenService.verifyAccessToken(result.tokens.accessToken);

    expect(currentUser.actAsBy).toBe(adminId);
  });

  it('does not flag a normal session as impersonated', async () => {
    const { service, sessions } = createService();

    await service.createSession(user, context);

    const session = await sessions.findById('session-1');

    expect(session?.signedAsAdminId).toBeNull();
  });

  it('re-derives actAsBy from the session on refresh, ignoring the old token', async () => {
    const { service, tokens } = createService();
    const first = await service.createImpersonatedSession(user, adminId, context);

    const refreshed = await service.refresh(first.tokens.refreshToken);

    const tokenService: TokenService = new TokenService(config, tokens);
    const currentUser = await tokenService.verifyAccessToken(refreshed.accessToken);

    expect(currentUser.actAsBy).toBe(adminId);
  });

  it('keeps a normal session refresh free of the actAsBy claim', async () => {
    const { service, tokens } = createService();
    const first = await service.createSession(user, context);

    const refreshed = await service.refresh(first.refreshToken);

    const tokenService: TokenService = new TokenService(config, tokens);
    const currentUser = await tokenService.verifyAccessToken(refreshed.accessToken);

    expect(currentUser.actAsBy).toBeUndefined();
  });
});

describe('TokenService allowlist', () => {
  it('rejects a validly signed access token whose allowlist key is gone', async () => {
    const tokens: FakeTokenRepository = new FakeTokenRepository();
    const tokenService: TokenService = new TokenService(config, tokens);
    const pair = await tokenService.issuePair({
      userId: user.id,
      role: user.role,
      sessionId: 'session-x',
    });

    await expect(tokenService.verifyAccessToken(pair.accessToken)).resolves.toMatchObject({
      id: user.id,
      sessionId: 'session-x',
    });

    await tokens.deleteAllForSession(user.id, 'session-x');

    await expect(tokenService.verifyAccessToken(pair.accessToken)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'AUTH_TOKEN_INVALID',
    );
  });
});
