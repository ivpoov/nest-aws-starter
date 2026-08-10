import type { AuthConfig } from '@configs/auth.config.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { CreateSessionDataInterface } from '@modules/session/interfaces/create-session-data.interface.js';
import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';
import type { SessionRepositoryInterface } from '@modules/session/interfaces/session-repository.interface.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { RotateTokensDataInterface } from '@modules/token/interfaces/rotate-tokens-data.interface.js';
import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';
import type { RotationStateInterface } from '@modules/token/interfaces/rotation-state.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
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
  // Captures the ttlSec each key was last set with — the fake has no real
  // TTL semantics, so this is how tests assert "the Redis key would have
  // expired at the right time" without a real Redis clock.
  public readonly ttlSecByKey: Map<string, number> = new Map();
  // The pair a grace key can replay, kept beside it exactly as the Redis
  // implementation keeps both halves in one value.
  public readonly replays: Map<string, RotationGracePairInterface> = new Map();

  public async setAccessToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:access`, token);
    this.ttlSecByKey.set(`${userId}:${sessionId}:access`, ttlSec);
  }

  public async setRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:refresh`, token);
    this.ttlSecByKey.set(`${userId}:${sessionId}:refresh`, ttlSec);
  }

  public async matchesAccessToken(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<boolean> {
    return this.keys.get(`${userId}:${sessionId}:access`) === token;
  }

  public async readRotationState(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<RotationStateInterface> {
    const graceKey: string = `${userId}:${sessionId}:prev`;

    return {
      isCurrent: this.keys.get(`${userId}:${sessionId}:refresh`) === token,
      replay: this.keys.get(graceKey) === token ? (this.replays.get(graceKey) ?? null) : null,
    };
  }

  // Mirrors the Lua script's all-or-nothing semantics: compare first, then
  // write the grace entry and both keys, or write nothing at all.
  public async rotateTokens(data: RotateTokensDataInterface): Promise<boolean> {
    const refreshKey: string = `${data.userId}:${data.sessionId}:refresh`;

    if (this.keys.get(refreshKey) !== data.expectedRefreshToken) return false;

    const graceKey: string = `${data.userId}:${data.sessionId}:prev`;

    this.keys.set(graceKey, data.expectedRefreshToken);
    this.replays.set(graceKey, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    this.ttlSecByKey.set(graceKey, data.graceTtlSec);
    await this.setRefreshToken(data.userId, data.sessionId, data.refreshToken, data.refreshTtlSec);
    await this.setAccessToken(data.userId, data.sessionId, data.accessToken, data.accessTtlSec);

    return true;
  }

  public async deleteAllForSession(userId: string, sessionId: string): Promise<void> {
    for (const suffix of ['access', 'refresh', 'prev']) {
      this.keys.delete(`${userId}:${sessionId}:${suffix}`);
      this.replays.delete(`${userId}:${sessionId}:${suffix}`);
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

// Fail-safe cross-store ordering (conventions §7a). verifyAccessToken authorizes
// on allowlist membership ALONE — it never reads activeUntil — so the Redis
// delete is the write that actually revokes and the row write is bookkeeping.
// A happy-path assertion passes under either order, so each test here induces a
// real failure BETWEEN the two writes and asserts the surviving state is
// restrictive (token dead, row stale) rather than permissive (row revoked, token
// still usable for its full TTL). Restore the original order and every one of
// them goes red on the verifyAccessToken assertion.
describe('SessionService revocation ordering under an induced mid-operation failure', () => {
  function expectDeadToken(pair: TokenPairInterface, tokens: FakeTokenRepository): Promise<void> {
    const tokenService: TokenService = new TokenService(config, tokens);

    return expect(tokenService.verifyAccessToken(pair.accessToken)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'AUTH_TOKEN_INVALID',
    ) as Promise<void>;
  }

  it('revokeSession: the token is dead even though the row write never landed', async () => {
    const { service, tokens, sessions } = createService();
    const pair: TokenPairInterface = await service.createSession(user, context);
    const before: SessionInterface | null = await sessions.findById('session-1');
    // The process dies between the two cross-store writes: the row write is
    // never applied at all, which is the state a crash actually leaves.
    const spy = vi
      .spyOn(sessions, 'setActiveUntil')
      .mockRejectedValue(new Error('induced failure mid-revocation'));

    await expect(service.revokeSession(user.id, 'session-1')).rejects.toThrow(
      'induced failure mid-revocation',
    );

    // Restrictive half: access is already gone.
    await expectDeadToken(pair, tokens);
    // Stale half: the row still says active. Annoying to look at, never unsafe.
    expect((await sessions.findById('session-1'))?.activeUntil.getTime()).toBe(
      before?.activeUntil.getTime(),
    );

    spy.mockRestore();

    // Self-correcting: the next revoke finishes the bookkeeping.
    await service.revokeSession(user.id, 'session-1');

    expect((await sessions.findById('session-1'))?.activeUntil.getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it('revokeAllForUser: every allowlist key is gone before the row write can fail', async () => {
    const { service, tokens, sessions } = createService();
    const first: TokenPairInterface = await service.createSession(user, context);
    const second: TokenPairInterface = await service.createSession(user, context);
    const spy = vi
      .spyOn(sessions, 'endAllByUserId')
      .mockRejectedValue(new Error('induced failure mid-revocation'));

    await expect(service.revokeAllForUser(user.id)).rejects.toThrow(
      'induced failure mid-revocation',
    );

    await expectDeadToken(first, tokens);
    await expectDeadToken(second, tokens);
    expect([...tokens.keys.keys()].filter((key) => key.startsWith(`${user.id}:`))).toHaveLength(0);

    spy.mockRestore();

    // The count still comes from the row write, which now runs second: it
    // reports the rows that were active when it ran, unchanged by the reorder.
    expect(await service.revokeAllForUser(user.id)).toBe(2);
  });

  it('refresh-reuse tripwire: the thief loses the access token even if the row write fails', async () => {
    const { service, tokens, sessions } = createService();
    const first: TokenPairInterface = await service.createSession(user, context);
    const live: TokenPairInterface = await service.refresh(first.refreshToken);

    tokens.keys.delete(`${user.id}:session-1:prev`); // grace TTL elapsed

    const spy = vi
      .spyOn(sessions, 'setActiveUntil')
      .mockRejectedValue(new Error('induced failure mid-revocation'));

    await expect(service.refresh(first.refreshToken)).rejects.toThrow(
      'induced failure mid-revocation',
    );

    // The path where this matters most: the thief already holds a live access
    // token, so the allowlist delete must survive a failed row write.
    await expectDeadToken(live, tokens);

    spy.mockRestore();
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

  it('caps the refresh token Redis TTL at the impersonation window, not the 30-day default', async () => {
    const { service, tokens } = createService();

    const result = await service.createImpersonatedSession(user, adminId, context);

    expect(tokens.ttlSecByKey.get(`${user.id}:${result.sessionId}:refresh`)).toBe(3_600);
    expect(tokens.ttlSecByKey.get(`${user.id}:${result.sessionId}:refresh`)).not.toBe(
      config.refreshTtlSec,
    );
  });

  it('keeps the normal refresh token TTL at the configured 30-day default', async () => {
    const { service, tokens } = createService();

    await service.createSession(user, context);

    expect(tokens.ttlSecByKey.get(`${user.id}:session-1:refresh`)).toBe(config.refreshTtlSec);
  });

  it('keeps the capped TTL after rotating an impersonated session', async () => {
    const { service, tokens } = createService();
    const first = await service.createImpersonatedSession(user, adminId, context);

    await service.refresh(first.tokens.refreshToken);

    expect(tokens.ttlSecByKey.get(`${user.id}:${first.sessionId}:refresh`)).toBe(3_600);
  });

  // Release-review fix (case a): the 1h window is an ABSOLUTE cap, not a
  // sliding one — rotating near expiry must not push activeUntil back out
  // to now+3600, and the rotated token's TTL must match the remaining
  // budget so Redis/JWT expiry and the session die together.
  it('clamps activeUntil instead of extending it when rotating an impersonated session near expiry', async () => {
    const { service, tokens, sessions } = createService();
    const first = await service.createImpersonatedSession(user, adminId, context);
    const nearExpiry: Date = new Date(Date.now() + 5_000);

    await sessions.setActiveUntil(first.sessionId, nearExpiry);
    await service.refresh(first.tokens.refreshToken);

    const rotatedActiveUntil: number | undefined = (
      await sessions.findById(first.sessionId)
    )?.activeUntil.getTime();
    const ttl: number = tokens.ttlSecByKey.get(`${user.id}:${first.sessionId}:refresh`) ?? 0;

    expect(rotatedActiveUntil).toBe(nearExpiry.getTime());
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5);
  });

  // Release-review fix (case b): rotating immediately after creation must
  // leave the original bound untouched — the clamp always picks the
  // existing activeUntil since it can never be later than now+3600 freshly
  // computed at rotation time.
  it('leaves the activeUntil bound unchanged when rotating right after creation', async () => {
    const { service, sessions } = createService();
    const first = await service.createImpersonatedSession(user, adminId, context);
    const originalActiveUntil: number | undefined = (
      await sessions.findById(first.sessionId)
    )?.activeUntil.getTime();

    await service.refresh(first.tokens.refreshToken);

    const rotatedActiveUntil: number | undefined = (
      await sessions.findById(first.sessionId)
    )?.activeUntil.getTime();

    expect(rotatedActiveUntil).toBe(originalActiveUntil);
  });

  // Release-review fix (case c, regression guard): normal sessions keep the
  // sliding window exactly as before — every refresh re-grants the full TTL.
  //
  // The clock is pinned and stepped by hand rather than left to run. Both
  // bounds are `Date.now() + refreshTtlSec * 1000` evaluated at their own
  // moment, so a create and a refresh that land in the same millisecond —
  // which is most of them, and reliably so under the parallel module runs of
  // scripts/subtraction-test.mjs — produce equal bounds and fail a
  // `toBeGreaterThan` on nothing but timing. Controlling the clock is also
  // strictly the better test: the window must move by exactly the elapsed
  // time, which "greater than" never checked.
  it('still extends activeUntil on every refresh for a normal (non-impersonated) session', async () => {
    const createdAt: Date = new Date('2026-08-09T12:00:00.000Z');
    const elapsedMs: number = 1_000;

    vi.useFakeTimers();
    vi.setSystemTime(createdAt);

    try {
      const { service, sessions } = createService();
      const first = await service.createSession(user, context);
      const originalActiveUntil: number =
        (await sessions.findById('session-1'))?.activeUntil.getTime() ?? 0;

      vi.setSystemTime(new Date(createdAt.getTime() + elapsedMs));

      await service.refresh(first.refreshToken);

      const rotatedActiveUntil: number =
        (await sessions.findById('session-1'))?.activeUntil.getTime() ?? 0;

      expect(originalActiveUntil).toBe(createdAt.getTime() + config.refreshTtlSec * 1_000);
      expect(rotatedActiveUntil).toBe(originalActiveUntil + elapsedMs);
    } finally {
      vi.useRealTimers();
    }
  });

  // The Critical fix under test: rotate()'s happy path must gate on
  // activeUntil explicitly, not merely on "the Redis key still exists" — the
  // fake token repository has no real TTL semantics, so this isolates that
  // explicit check from Redis's own expiry.
  it('rejects a refresh once activeUntil has passed, even with the Redis key still present', async () => {
    const { service, tokens, sessions } = createService();
    const first = await service.createImpersonatedSession(user, adminId, context);

    await sessions.setActiveUntil(first.sessionId, new Date(Date.now() - 1000));

    await expect(service.refresh(first.tokens.refreshToken)).rejects.toSatisfy(
      (caught: unknown): boolean =>
        caught instanceof UnauthorizedError && caught.args.code === 'AUTH_SESSION_EXPIRED',
    );
    expect(tokens.keys.has(`${user.id}:${first.sessionId}:refresh`)).toBe(false);
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
