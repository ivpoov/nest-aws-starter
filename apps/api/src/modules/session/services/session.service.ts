import { type AuthConfig, authConfig } from '@configs/auth.config.js';
import { type RetentionConfig, retentionConfig } from '@configs/retention.config.js';
import { parseDevice } from '@helpers/parse-device.helper.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { purgeInBatches } from '@modules/common/helpers/purge-in-batches.helper.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import {
  IMPERSONATION_ACTIVE_TTL_SEC,
  SESSION_REPOSITORY,
} from '@modules/session/constants/session.constants.js';
import {
  AUTH_REFRESH_INVALID,
  AUTH_SESSION_EXPIRED,
  SESSION_NOT_FOUND,
} from '@modules/session/constants/session-errors.constants.js';
import type { CreateSessionResultInterface } from '@modules/session/interfaces/create-session-result.interface.js';
import type { LoginAsSessionResultInterface } from '@modules/session/interfaces/login-as-session-result.interface.js';
import type { RotatedWindowInterface } from '@modules/session/interfaces/rotated-window.interface.js';
import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';
import type { SessionContextInterface } from '@modules/session/interfaces/session-context.interface.js';
import type { SessionForUserInterface } from '@modules/session/interfaces/session-for-user.interface.js';
import type { SessionRepositoryInterface } from '@modules/session/interfaces/session-repository.interface.js';
import { TOKEN_REPOSITORY } from '@modules/token/constants/token.constants.js';
import type { RefreshTokenClaimsInterface } from '@modules/token/interfaces/refresh-token-claims.interface.js';
import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';
import type { RotationStateInterface } from '@modules/token/interfaces/rotation-state.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { USER_BLOCKED } from '@modules/user/constants/user-errors.constants.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { UserStatusEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

const DAY_MS = 86_400_000;

@Injectable()
export class SessionService {
  private readonly logger = new CustomLoggerService(SessionService.name);

  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepositoryInterface,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepositoryInterface,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    @Inject(retentionConfig.KEY) private readonly retention: RetentionConfig,
  ) {}

  public async createSession(
    user: UserInterface,
    context: SessionContextInterface,
  ): Promise<TokenPairInterface> {
    const { tokens }: CreateSessionResultInterface = await this.createSessionRecord(
      user,
      context,
      null,
    );

    return tokens;
  }

  // Admin login-as: mints a normal token pair for the target user, but the
  // session row carries signedAsAdminId and the access token carries actAsBy
  // — every guard and both sessions UIs read those, never a separate flag.
  public async createImpersonatedSession(
    targetUser: UserInterface,
    adminId: string,
    context: SessionContextInterface,
  ): Promise<LoginAsSessionResultInterface> {
    const { session, tokens }: CreateSessionResultInterface = await this.createSessionRecord(
      targetUser,
      context,
      adminId,
    );

    return { tokens, sessionId: session.id };
  }

  public async refresh(oldRefreshToken: string): Promise<TokenPairInterface> {
    const claims: RefreshTokenClaimsInterface =
      await this.tokenService.verifyRefreshToken(oldRefreshToken);
    // ONE snapshot for the whole decision. Asking "is there a grace replay?"
    // and "is this the current token?" as two reads let a rotation commit
    // between them, and the honest second tab then answered no to both and got
    // treated as a token thief — revoking every session the user had.
    const state: RotationStateInterface = await this.tokenRepository.readRotationState(
      claims.userId,
      claims.sessionId,
      oldRefreshToken,
    );

    if (state.replay) return this.replayGracePair(claims, state.replay);

    if (!state.isCurrent) {
      await this.handleInvalidRefresh(claims);
    }

    return this.rotate(claims, oldRefreshToken);
  }

  public async listSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<SessionForUserInterface[]> {
    const sessions: SessionInterface[] = await this.sessionRepository.findActiveByUserId(
      userId,
      new Date(),
    );

    return sessions.map(
      (session: SessionInterface): SessionForUserInterface => ({
        ...session,
        isCurrent: session.id === currentSessionId,
        isImpersonated: session.signedAsAdminId !== null,
      }),
    );
  }

  public async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session: SessionInterface | null = await this.sessionRepository.findById(sessionId);

    if (!session || session.userId !== userId) throw new NotFoundError(SESSION_NOT_FOUND);

    // Fail-safe ordering (§7a). The ALLOWLIST is what authorizes: verifyAccessToken
    // checks Redis membership and never reads activeUntil, so this delete is the
    // write that actually revokes and the row write below is bookkeeping. Delete
    // first, and a crash between them leaves the token already dead with the row
    // still saying active — restrictive, and repaired by the next revoke. The
    // opposite order left both UIs saying "revoked" while the access token kept
    // working for its full TTL. Do not reorder these two lines.
    await this.tokenRepository.deleteAllForSession(userId, sessionId);
    await this.sessionRepository.setActiveUntil(sessionId, new Date());
    this.logger.log(`Session revoked: ${sessionId}`);
  }

  public async revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const sessions: SessionForUserInterface[] = await this.listSessions(userId, currentSessionId);
    const others: SessionForUserInterface[] = sessions.filter(
      (session: SessionForUserInterface): boolean => !session.isCurrent,
    );

    for (const session of others) {
      await this.revokeSession(userId, session.id);
    }

    return others.length;
  }

  public async revokeAllForUser(userId: string): Promise<number> {
    // Fail-safe ordering (§7a), same reasoning as revokeSession: the allowlist
    // sweep is the write that removes access, so it goes first. The row write
    // stays second and still supplies the reported count — it counts the rows
    // that were active when it ran, which is the number the caller reports.
    await this.tokenRepository.deleteAllForUser(userId);

    const count: number = await this.sessionRepository.endAllByUserId(userId, new Date());

    this.logger.log(`All sessions revoked for user ${userId}: ${count}`);

    return count;
  }

  // Concurrent refresh inside the grace window: idempotent replay of the pair
  // the winner recorded, never a second rotation. The grace entry carries that
  // pair whole, so replaying it needs no further reads and the access token can
  // never belong to a different generation than the refresh token beside it.
  //
  // ACCEPTED RISK, stated plainly, in two parts.
  //
  // First: for as long as the grace entry lives, whoever presents the
  // superseded token is handed the recorded pair and the tripwire stays silent
  // — an attacker holding a captured superseded token can trade it for the live
  // one. This is inherent to a grace window, not an oversight: inside it an
  // honest second tab and a replay are byte-for-byte indistinguishable, since
  // the only signal that separates them (client identity) is not carried on
  // this endpoint.
  //
  // Second: to be replayable at all, that pair is stored in Redis VERBATIM —
  // the live access and refresh token, not digests, because a digest is
  // one-way and cannot be turned back into a token. It is the single exception
  // to the allowlist's digests-only rule, so a Redis dump taken inside the
  // window yields one usable pair per session that rotated in it. The token
  // being replaced is stored only as a digest, and the entry's exact contents
  // are pinned in TokenRedisRepository's spec so nothing raw creeps in later.
  //
  // Both parts are bounded by the same number: AUTH_REFRESH_GRACE_SEC (10s by
  // default), after which the entry is gone, the token matches neither key, and
  // handleInvalidRefresh() revokes the whole session. Narrowing is a knob, not
  // a code change: lower the config value. Closing part one needs client
  // binding (ip/device on the refresh call), which trades it for spurious
  // logouts on network changes — a product decision, not one to smuggle into a
  // correctness fix. See ADR 0003 for why encrypting the entry was rejected.
  private async replayGracePair(
    claims: RefreshTokenClaimsInterface,
    replay: RotationGracePairInterface,
  ): Promise<TokenPairInterface> {
    // The same account gate rotate() applies. Without it the grace entry is a
    // way for a blocked account to keep collecting fresh access tokens for the
    // whole window — this path returns before rotate() is ever reached.
    await this.assertAccountActive(claims.userId);

    return {
      accessToken: replay.accessToken,
      refreshToken: replay.refreshToken,
      expiresInSec: this.config.accessTtlSec,
    };
  }

  // Status, not just role, is re-read from the row on every refresh. The admin
  // block path revokes the allowlist before flipping the status, so reaching
  // here with a non-active account means that revoke never ran (partially
  // applied block, direct database edit, a status added later). Finish the job
  // through that very same revoke rather than a bespoke one.
  private async assertAccountActive(userId: string): Promise<UserInterface> {
    const user: UserInterface = await this.userService.findByIdOrThrow(userId);

    if (user.status !== UserStatusEnum.ACTIVE) {
      await this.revokeAllForUser(userId);

      throw new ForbiddenError(USER_BLOCKED);
    }

    return user;
  }

  private async handleInvalidRefresh(claims: RefreshTokenClaimsInterface): Promise<never> {
    const session: SessionInterface | null = await this.sessionRepository.findById(
      claims.sessionId,
    );
    const isAlive: boolean = session !== null && session.activeUntil.getTime() > Date.now();

    if (isAlive) {
      // Stolen-token tripwire: a signed refresh token that matches neither the
      // current nor the grace key while the session lives means reuse.
      //
      // Fail-safe ordering (§7a), same reasoning as revokeSession: the allowlist
      // delete is the write that actually revokes, so it goes first. This is the
      // path where it matters most — the thief already holds a live access token,
      // and the old order let a crash here leave that token usable for its whole
      // TTL while the row and both UIs claimed the session was revoked.
      await this.tokenRepository.deleteAllForSession(claims.userId, claims.sessionId);
      await this.sessionRepository.setActiveUntil(claims.sessionId, new Date());
      this.logger.warn(
        `AUTH_REFRESH_REUSED: refresh reuse detected for session ${claims.sessionId} — session revoked`,
      );

      throw new UnauthorizedError(AUTH_REFRESH_INVALID);
    }

    throw new UnauthorizedError(session ? AUTH_SESSION_EXPIRED : AUTH_REFRESH_INVALID);
  }

  private async rotate(
    claims: RefreshTokenClaimsInterface,
    oldRefreshToken: string,
  ): Promise<TokenPairInterface> {
    const [user, session]: [UserInterface, SessionInterface | null] = await Promise.all([
      this.assertAccountActive(claims.userId),
      this.sessionRepository.findById(claims.sessionId),
    ]);

    // Explicit liveness gate, independent of "the Redis key still existed":
    // rotate() is only ever reached when the presented token matched the
    // stored one, so without this check a Redis/Postgres TTL mismatch (or a
    // future config change) could let a session outlive its advertised
    // activeUntil indefinitely. Impersonated sessions rely on this the most
    // — activeUntil is their only visibility signal on the sessions pages.
    if (!session || session.activeUntil.getTime() <= Date.now()) {
      await this.tokenRepository.deleteAllForSession(claims.userId, claims.sessionId);

      throw new UnauthorizedError(session ? AUTH_SESSION_EXPIRED : AUTH_REFRESH_INVALID);
    }

    // Re-derived from the session row, never trusted from the old token —
    // the source of truth for whether this refresh keeps the impersonation
    // claim alive.
    const signedAsAdminId: string | null = session.signedAsAdminId;
    const window: RotatedWindowInterface = this.rotatedWindow(session);
    // Atomic: the replacing pair is recorded in the grace entry and installed
    // as the current one in a single indivisible Redis step, gated on the
    // presented token still being current. No observer ever sees a half-rotated
    // session, so no honest tab is left holding a token that matches neither —
    // the only thing that used to trip the tripwire falsely.
    const pair: TokenPairInterface | null = await this.tokenService.rotatePair(
      {
        userId: claims.userId,
        role: user.role,
        sessionId: claims.sessionId,
        actAsBy: signedAsAdminId,
        refreshTtlSec: window.ttlSec,
      },
      oldRefreshToken,
    );

    if (pair === null) return this.resolveLostRotation(claims, oldRefreshToken);

    await this.sessionRepository.setActiveUntil(claims.sessionId, window.activeUntil);
    void this.sessionRepository
      .touchLastActive(claims.sessionId, new Date())
      .catch((caught: unknown): void =>
        this.logger.warn(`Failed to touch session ${claims.sessionId}: ${String(caught)}`),
      );

    return pair;
  }

  // The compare-and-swap was lost, so another refresher rotated this session
  // between our read and our write. Its rotation is atomic, so by now the
  // presented token either has a grace entry (an honest concurrent tab — replay
  // the winner's pair) or has none (a replay of a token already superseded
  // twice — still a thief, still trips the tripwire).
  private async resolveLostRotation(
    claims: RefreshTokenClaimsInterface,
    oldRefreshToken: string,
  ): Promise<TokenPairInterface> {
    const state: RotationStateInterface = await this.tokenRepository.readRotationState(
      claims.userId,
      claims.sessionId,
      oldRefreshToken,
    );

    if (state.replay) return this.replayGracePair(claims, state.replay);

    return this.handleInvalidRefresh(claims);
  }

  private async createSessionRecord(
    user: UserInterface,
    context: SessionContextInterface,
    signedAsAdminId: string | null,
  ): Promise<CreateSessionResultInterface> {
    const ttlSec: number = this.ttlSecFor(signedAsAdminId);
    const activeUntil: Date = new Date(Date.now() + ttlSec * 1000);
    const session: SessionInterface = await this.sessionRepository.create({
      userId: user.id,
      device: parseDevice(context.userAgent),
      ip: context.ip,
      activeUntil,
      signedAsAdminId,
    });

    this.logger.log(`Session created: ${session.id} for user ${user.id}`);

    const tokens: TokenPairInterface = await this.tokenService.issuePair({
      userId: user.id,
      role: user.role,
      sessionId: session.id,
      actAsBy: signedAsAdminId,
      refreshTtlSec: ttlSec,
    });

    return { session, tokens };
  }

  // Grant on session creation only — a fresh session always gets its full
  // window. rotate() uses rotatedWindow() instead, which clamps rather than
  // re-grants for impersonated sessions.
  private ttlSecFor(signedAsAdminId: string | null): number {
    return signedAsAdminId ? IMPERSONATION_ACTIVE_TTL_SEC : this.config.refreshTtlSec;
  }

  // Normal sessions keep the sliding window: every refresh re-grants the
  // full refreshTtlSec, exactly as before. Impersonated sessions get an
  // ABSOLUTE cap instead — activeUntil never moves past the original hour,
  // however often the token is refreshed — and the rotated pair's TTL is
  // whatever budget remains, so the Redis key and JWT exp die with the
  // session rather than an hour after the last refresh.
  private rotatedWindow(session: SessionInterface): RotatedWindowInterface {
    if (!session.signedAsAdminId) {
      return {
        activeUntil: new Date(Date.now() + this.config.refreshTtlSec * 1000),
        ttlSec: this.config.refreshTtlSec,
      };
    }

    const now: number = Date.now();
    const activeUntil: Date = new Date(
      Math.min(session.activeUntil.getTime(), now + IMPERSONATION_ACTIVE_TTL_SEC * 1000),
    );
    const ttlSec: number = Math.max(1, Math.ceil((activeUntil.getTime() - now) / 1000));

    return { activeUntil, ttlSec };
  }

  // Retention. Disabled by RETENTION_ENABLED, and otherwise deletes rows
  // expired before the configured window in bounded batches — see
  // purgeInBatches for why the loop is capped as well as batched.
  public async purgeExpired(): Promise<number> {
    if (!this.retention.isEnabled) return 0;

    const cutoff: Date = new Date(Date.now() - this.retention.sessionDays * DAY_MS);

    return purgeInBatches('session', this.retention.batchSize, this.logger, (limit: number) =>
      this.sessionRepository.deleteExpiredBefore(cutoff, limit),
    );
  }
}
