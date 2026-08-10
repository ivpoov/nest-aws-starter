import { type AuthConfig, authConfig } from '@configs/auth.config.js';
import { parseDevice } from '@helpers/parse-device.helper.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
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
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { TokenService } from '@modules/token/services/token.service.js';
import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SessionService {
  private readonly logger = new CustomLoggerService(SessionService.name);

  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    @Inject(SESSION_REPOSITORY) private readonly sessionRepository: SessionRepositoryInterface,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepositoryInterface,
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
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
    // Concurrent refresh inside the grace window: idempotent replay of the
    // pair the winning request minted, never a second rotation.
    const replay: RotationGracePairInterface | null =
      await this.tokenRepository.findRotationGraceReplay(
        claims.userId,
        claims.sessionId,
        oldRefreshToken,
      );

    if (replay) {
      return {
        accessToken: replay.accessToken,
        refreshToken: replay.refreshToken,
        expiresInSec: this.config.accessTtlSec,
      };
    }

    const isCurrent: boolean = await this.tokenRepository.matchesRefreshToken(
      claims.userId,
      claims.sessionId,
      oldRefreshToken,
    );

    if (!isCurrent) {
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

    await this.sessionRepository.setActiveUntil(sessionId, new Date());
    await this.tokenRepository.deleteAllForSession(userId, sessionId);
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
    const count: number = await this.sessionRepository.endAllByUserId(userId, new Date());

    await this.tokenRepository.deleteAllForUser(userId);
    this.logger.log(`All sessions revoked for user ${userId}: ${count}`);

    return count;
  }

  private async handleInvalidRefresh(claims: RefreshTokenClaimsInterface): Promise<never> {
    const session: SessionInterface | null = await this.sessionRepository.findById(
      claims.sessionId,
    );
    const isAlive: boolean = session !== null && session.activeUntil.getTime() > Date.now();

    if (isAlive) {
      // Stolen-token tripwire: a signed refresh token that matches neither the
      // current nor the grace key while the session lives means reuse.
      await this.sessionRepository.setActiveUntil(claims.sessionId, new Date());
      await this.tokenRepository.deleteAllForSession(claims.userId, claims.sessionId);
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
      this.userService.findByIdOrThrow(claims.userId),
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
    const pair: TokenPairInterface = await this.tokenService.issuePair({
      userId: claims.userId,
      role: user.role,
      sessionId: claims.sessionId,
      actAsBy: signedAsAdminId,
      refreshTtlSec: window.ttlSec,
    });

    await this.tokenRepository.setRotationGrace(
      claims.userId,
      claims.sessionId,
      oldRefreshToken,
      { accessToken: pair.accessToken, refreshToken: pair.refreshToken },
      this.config.refreshGraceSec,
    );
    await this.sessionRepository.setActiveUntil(claims.sessionId, window.activeUntil);
    void this.sessionRepository
      .touchLastActive(claims.sessionId, new Date())
      .catch((caught: unknown): void =>
        this.logger.warn(`Failed to touch session ${claims.sessionId}: ${String(caught)}`),
      );

    return pair;
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
}
