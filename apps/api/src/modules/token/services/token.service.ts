import { randomUUID } from 'node:crypto';
import { type AuthConfig, authConfig } from '@configs/auth.config.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { TOKEN_REPOSITORY } from '@modules/token/constants/token.constants.js';
import { AUTH_TOKEN_INVALID } from '@modules/token/constants/token-errors.constants.js';
import type { IssuePairDataInterface } from '@modules/token/interfaces/issue-pair-data.interface.js';
import type { RefreshTokenClaimsInterface } from '@modules/token/interfaces/refresh-token-claims.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';
import { type JWTPayload, jwtVerify, SignJWT } from 'jose';

@Injectable()
export class TokenService {
  private readonly secret: Uint8Array;

  constructor(
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepository: TokenRepositoryInterface,
  ) {
    this.secret = new TextEncoder().encode(config.jwtSecret);
  }

  public async issuePair(data: IssuePairDataInterface): Promise<TokenPairInterface> {
    const refreshTtlSec: number = data.refreshTtlSec ?? this.config.refreshTtlSec;
    const pair: TokenPairInterface = await this.mintPair(data, refreshTtlSec);

    await this.tokenRepository.setAccessToken(
      data.userId,
      data.sessionId,
      pair.accessToken,
      this.config.accessTtlSec,
    );
    await this.tokenRepository.setRefreshToken(
      data.userId,
      data.sessionId,
      pair.refreshToken,
      refreshTtlSec,
    );

    return pair;
  }

  // Rotation, all-or-nothing: the presented token's replacement is recorded
  // and installed in one atomic step, and only while the presented token is
  // still the current one. Resolves null when a concurrent refresher won that
  // swap — the pair minted here never reached the allowlist, so it is inert,
  // and the caller falls back to replaying the winner's pair.
  public async rotatePair(
    data: IssuePairDataInterface,
    expectedRefreshToken: string,
  ): Promise<TokenPairInterface | null> {
    const refreshTtlSec: number = data.refreshTtlSec ?? this.config.refreshTtlSec;
    const pair: TokenPairInterface = await this.mintPair(data, refreshTtlSec);
    const isRotated: boolean = await this.tokenRepository.rotateTokens({
      userId: data.userId,
      sessionId: data.sessionId,
      expectedRefreshToken,
      accessToken: pair.accessToken,
      accessTtlSec: this.config.accessTtlSec,
      refreshToken: pair.refreshToken,
      refreshTtlSec,
      graceTtlSec: this.config.refreshGraceSec,
    });

    return isRotated ? pair : null;
  }

  // Signs a pair without touching the allowlist — an unstored JWT is inert,
  // which is what lets rotatePair() mint first and commit only if it wins.
  private async mintPair(
    data: IssuePairDataInterface,
    refreshTtlSec: number,
  ): Promise<TokenPairInterface> {
    const accessToken: string = await this.sign(
      {
        role: data.role,
        sessionId: data.sessionId,
        ...(data.actAsBy ? { actAsBy: data.actAsBy } : {}),
      },
      data.userId,
      this.config.accessTtlSec,
    );
    const refreshToken: string = await this.sign(
      { sessionId: data.sessionId },
      data.userId,
      refreshTtlSec,
    );

    return { accessToken, refreshToken, expiresInSec: this.config.accessTtlSec };
  }

  // Validation = signature + allowlist membership: a verified JWT whose Redis
  // key is gone is dead — force-logout applies to access tokens instantly.
  public async verifyAccessToken(token: string): Promise<CurrentUserInterface> {
    const payload: JWTPayload = await this.verify(token);
    const userId: string = payload.sub ?? '';
    const sessionId: string = String(payload.sessionId ?? '');
    const isAllowlisted: boolean = await this.tokenRepository.matchesAccessToken(
      userId,
      sessionId,
      token,
    );

    if (!isAllowlisted) throw new UnauthorizedError(AUTH_TOKEN_INVALID);

    const actAsBy: string | undefined =
      typeof payload.actAsBy === 'string' ? payload.actAsBy : undefined;

    return {
      id: userId,
      role: payload.role as UserRoleEnum,
      sessionId,
      ...(actAsBy && { actAsBy }),
    };
  }

  public async verifyRefreshToken(token: string): Promise<RefreshTokenClaimsInterface> {
    const payload: JWTPayload = await this.verify(token);

    return { userId: payload.sub ?? '', sessionId: String(payload.sessionId ?? '') };
  }

  private async sign(claims: JWTPayload, subject: string, ttlSec: number): Promise<string> {
    return (
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(subject)
        // Random jti: two tokens minted in the same second must never be identical
        // (rotation depends on the new refresh token differing from the old one).
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime(`${ttlSec}s`)
        .sign(this.secret)
    );
  }

  private async verify(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret);

      return payload;
    } catch {
      throw new UnauthorizedError(AUTH_TOKEN_INVALID);
    }
  }
}
