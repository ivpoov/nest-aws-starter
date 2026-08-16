import type { AuthConfig } from '@configs/auth.config.js';
import type { CurrentUserInterface } from '@interfaces/current-user.interface.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import type { IssuePairDataInterface } from '@modules/token/interfaces/issue-pair-data.interface.js';
import type { RotateTokensDataInterface } from '@modules/token/interfaces/rotate-tokens-data.interface.js';
import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';
import type { RotationStateInterface } from '@modules/token/interfaces/rotation-state.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { TokenService } from '@modules/token/services/token.service.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';
import { type JWTPayload, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

const config: AuthConfig = {
  jwtSecret: 'unit-test-secret-with-at-least-32-characters',
  accessTtlSec: 900,
  refreshTtlSec: 2_592_000,
  refreshGraceSec: 7,
};

const SECRET: Uint8Array = new TextEncoder().encode(config.jwtSecret);
const FOREIGN_SECRET: Uint8Array = new TextEncoder().encode(
  'an-attacker-secret-with-at-least-32-characters',
);

const USER_ID = '01890a5d-ac96-774b-bcce-b302099a8057';
const SESSION_ID = 'session-token-spec';

// Minimal in-memory allowlist: every test below plants its forged token in it
// on purpose, so allowlist membership can never be what rejects the token —
// only `jwtVerify` can. That is what makes these specs detect a broken
// verifier instead of quietly passing beside one.
class FakeTokenRepository implements TokenRepositoryInterface {
  public readonly keys: Map<string, string> = new Map();
  public readonly replays: Map<string, RotationGracePairInterface> = new Map();

  public async setAccessToken(
    userId: string,
    sessionId: string,
    token: string,
    _ttlSec: number,
  ): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:access`, token);
  }

  public async setRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
    _ttlSec: number,
  ): Promise<void> {
    this.keys.set(`${userId}:${sessionId}:refresh`, token);
  }

  // Stores tokens verbatim: digesting is the Redis repository's business and
  // is pinned in its own spec. What matters here is only which token the
  // allowlist considers current.
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

  public async rotateTokens(data: RotateTokensDataInterface): Promise<boolean> {
    const refreshKey: string = `${data.userId}:${data.sessionId}:refresh`;

    if ((this.keys.get(refreshKey) ?? null) !== data.expectedRefreshToken) return false;

    const graceKey: string = `${data.userId}:${data.sessionId}:prev`;

    this.keys.set(graceKey, data.expectedRefreshToken);
    this.replays.set(graceKey, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    this.keys.set(refreshKey, data.refreshToken);
    this.keys.set(`${data.userId}:${data.sessionId}:access`, data.accessToken);

    return true;
  }

  public async deleteAllForSession(userId: string, sessionId: string): Promise<void> {
    for (const suffix of ['access', 'refresh', 'prev']) {
      this.keys.delete(`${userId}:${sessionId}:${suffix}`);
    }
  }

  public async deleteAllForUser(userId: string): Promise<void> {
    for (const key of [...this.keys.keys()]) {
      if (key.startsWith(`${userId}:`)) this.keys.delete(key);
    }
  }
}

interface SetupInterface {
  readonly service: TokenService;
  readonly repository: FakeTokenRepository;
}

function setup(): SetupInterface {
  const repository: FakeTokenRepository = new FakeTokenRepository();

  return { service: new TokenService(config, repository), repository };
}

function isTokenInvalid(caught: unknown): boolean {
  return caught instanceof UnauthorizedError && caught.args.code === 'AUTH_TOKEN_INVALID';
}

// Structurally valid, cryptographically whatever the caller asked for.
async function signToken(
  claims: JWTPayload,
  secret: Uint8Array,
  expiresIn: string,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USER_ID)
    .setJti('jti-token-spec')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

function encodeSegment(value: JWTPayload | Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeSegment(segment: string): JWTPayload {
  return JSON.parse(Buffer.from(segment, 'base64url').toString()) as JWTPayload;
}

// Rewrites the payload of an already-signed token and keeps the original
// signature — exactly what an attacker with a captured token can do.
function tamperClaim(token: string, claim: string, value: string): string {
  const [header, payload, signature]: string[] = token.split('.');
  const claims: JWTPayload = decodeSegment(payload ?? '');

  return `${header}.${encodeSegment({ ...claims, [claim]: value })}.${signature}`;
}

describe('TokenService signature verification', () => {
  it('accepts a token it signed itself and reports the signed role', async () => {
    const { service } = setup();
    const pair: TokenPairInterface = await service.issuePair({
      userId: USER_ID,
      role: UserRoleEnum.USER,
      sessionId: SESSION_ID,
    });

    const current: CurrentUserInterface = await service.verifyAccessToken(pair.accessToken);

    expect(current).toMatchObject({
      id: USER_ID,
      sessionId: SESSION_ID,
      role: UserRoleEnum.USER,
    });
  });

  it('reports ADMIN when ADMIN is what was actually signed', async () => {
    const { service } = setup();
    const pair: TokenPairInterface = await service.issuePair({
      userId: USER_ID,
      role: UserRoleEnum.ADMIN,
      sessionId: SESSION_ID,
    });

    const current: CurrentUserInterface = await service.verifyAccessToken(pair.accessToken);

    expect(current.role).toBe(UserRoleEnum.ADMIN);
  });

  it('rejects an access token signed with a foreign secret, allowlisted or not', async () => {
    const { service, repository } = setup();
    const forged: string = await signToken(
      { role: UserRoleEnum.ADMIN, sessionId: SESSION_ID },
      FOREIGN_SECRET,
      '900s',
    );

    await repository.setAccessToken(USER_ID, SESSION_ID, forged, 900);

    await expect(service.verifyAccessToken(forged)).rejects.toSatisfy(isTokenInvalid);
  });

  it('rejects a refresh token signed with a foreign secret', async () => {
    const { service, repository } = setup();
    const forged: string = await signToken({ sessionId: SESSION_ID }, FOREIGN_SECRET, '900s');

    await repository.setRefreshToken(USER_ID, SESSION_ID, forged, 900);

    await expect(service.verifyRefreshToken(forged)).rejects.toSatisfy(isTokenInvalid);
  });

  it('rejects an access token whose role claim was escalated after signing', async () => {
    const { service, repository } = setup();
    const pair: TokenPairInterface = await service.issuePair({
      userId: USER_ID,
      role: UserRoleEnum.USER,
      sessionId: SESSION_ID,
    });
    const escalated: string = tamperClaim(pair.accessToken, 'role', UserRoleEnum.ADMIN);

    // The tampered token IS the allowlisted one: nothing but the signature
    // check stands between it and an ADMIN CurrentUserInterface.
    await repository.setAccessToken(USER_ID, SESSION_ID, escalated, 900);

    expect(decodeSegment(escalated.split('.')[1] ?? '').role).toBe(UserRoleEnum.ADMIN);
    await expect(service.verifyAccessToken(escalated)).rejects.toSatisfy(isTokenInvalid);
  });

  it('rejects an access token whose subject was swapped after signing', async () => {
    const { service, repository } = setup();
    const pair: TokenPairInterface = await service.issuePair({
      userId: USER_ID,
      role: UserRoleEnum.USER,
      sessionId: SESSION_ID,
    });
    const impersonating: string = tamperClaim(pair.accessToken, 'sub', 'someone-elses-user-id');

    await repository.setAccessToken('someone-elses-user-id', SESSION_ID, impersonating, 900);

    await expect(service.verifyAccessToken(impersonating)).rejects.toSatisfy(isTokenInvalid);
  });

  it('rejects an unsigned alg:none token', async () => {
    const { service, repository } = setup();
    const header: string = encodeSegment({ alg: 'none', typ: 'JWT' });
    const payload: string = encodeSegment({
      sub: USER_ID,
      sessionId: SESSION_ID,
      role: UserRoleEnum.ADMIN,
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    const unsigned: string = `${header}.${payload}.`;

    await repository.setAccessToken(USER_ID, SESSION_ID, unsigned, 900);

    await expect(service.verifyAccessToken(unsigned)).rejects.toSatisfy(isTokenInvalid);
  });

  it('rejects a correctly signed but expired access token', async () => {
    const { service, repository } = setup();
    const expired: string = await signToken(
      { role: UserRoleEnum.USER, sessionId: SESSION_ID },
      SECRET,
      '-60s',
    );

    // Still in the allowlist — the Redis key outliving the JWT exp is exactly
    // the drift this check exists for.
    await repository.setAccessToken(USER_ID, SESSION_ID, expired, 900);

    await expect(service.verifyAccessToken(expired)).rejects.toSatisfy(isTokenInvalid);
  });

  it('rejects a correctly signed but expired refresh token', async () => {
    const { service, repository } = setup();
    const expired: string = await signToken({ sessionId: SESSION_ID }, SECRET, '-60s');

    await repository.setRefreshToken(USER_ID, SESSION_ID, expired, 900);

    await expect(service.verifyRefreshToken(expired)).rejects.toSatisfy(isTokenInvalid);
  });
});

describe('TokenService rotatePair', () => {
  const issueData: IssuePairDataInterface = {
    userId: USER_ID,
    role: UserRoleEnum.USER,
    sessionId: SESSION_ID,
  };

  it('swaps the pair and records it as the replay for the presented token', async () => {
    const { service, repository } = setup();
    const first: TokenPairInterface = await service.issuePair(issueData);

    const rotated: TokenPairInterface | null = await service.rotatePair(
      issueData,
      first.refreshToken,
    );
    const state: RotationStateInterface = await repository.readRotationState(
      USER_ID,
      SESSION_ID,
      first.refreshToken,
    );

    expect(rotated).not.toBeNull();
    expect(state.isCurrent).toBe(false);
    expect(state.replay).toEqual({
      accessToken: rotated?.accessToken,
      refreshToken: rotated?.refreshToken,
    });
    await expect(
      repository.matchesAccessToken(USER_ID, SESSION_ID, rotated?.accessToken ?? ''),
    ).resolves.toBe(true);
  });

  it('resolves null and leaves the allowlist untouched when the swap is lost', async () => {
    const { service, repository } = setup();
    const first: TokenPairInterface = await service.issuePair(issueData);
    const winner: TokenPairInterface | null = await service.rotatePair(
      issueData,
      first.refreshToken,
    );

    // Second caller still presenting the token the winner already superseded.
    const loser: TokenPairInterface | null = await service.rotatePair(
      issueData,
      first.refreshToken,
    );
    const state: RotationStateInterface = await repository.readRotationState(
      USER_ID,
      SESSION_ID,
      winner?.refreshToken ?? '',
    );

    expect(loser).toBeNull();
    // The loser's minted pair never entered the allowlist, so the winner's is
    // still the live one and the loser's is inert.
    expect(state.isCurrent).toBe(true);
    await expect(
      repository.matchesAccessToken(USER_ID, SESSION_ID, winner?.accessToken ?? ''),
    ).resolves.toBe(true);
  });
});
