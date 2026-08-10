import { randomUUID } from 'node:crypto';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { UnauthorizedError } from '@modules/common/errors/unauthorized.error.js';
import { SessionService } from '@modules/session/services/session.service.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import type { UserWithMethodTypesInterface } from '@modules/user/interfaces/user-with-method-types.interface.js';
import { UserService } from '@modules/user/services/user.service.js';
import { UserStatusEnum } from '@nest-aws-starter/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

// Enough in-flight refreshes of the SAME token to reliably interleave inside
// the rotation window against a real Redis. Sequential calls would prove
// nothing here — the bug only exists between two concurrent writers.
const CONCURRENCY = 8;

// Real HTTP load: separate sockets, separate event-loop turns, so a rotation
// can commit in the middle of another request's own reads.
const HTTP_CONCURRENCY = 12;
const HTTP_ROUNDS = 40;
const HTTP_RACE_TIMEOUT_MS = 120_000;

describe('refresh token rotation under concurrency', () => {
  let app: NestFastifyApplication;
  let sessions: SessionService;
  let users: UserService;
  let redis: RedisClientType;

  beforeAll(async () => {
    app = await createTestApp();
    sessions = app.get(SessionService);
    users = app.get(UserService);
    redis = app.get<RedisClientType>(REDIS_CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  async function registerUserWithEmail(): Promise<{ email: string; pair: TokenPairInterface }> {
    const email: string = `rotation-e2e-${randomUUID()}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .set('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/141.0')
      .send({ displayName: 'Rotation E2E', email, password: 'correct-horse-battery' })
      .expect(201);

    return { email, pair: response.body };
  }

  async function registerUser(): Promise<TokenPairInterface> {
    return (await registerUserWithEmail()).pair;
  }

  function isRefreshInvalid(caught: unknown): boolean {
    return caught instanceof UnauthorizedError && caught.args.code === 'AUTH_REFRESH_INVALID';
  }

  function isBlocked(caught: unknown): boolean {
    return caught instanceof ForbiddenError && caught.args.code === 'USER_BLOCKED';
  }

  // Real sockets, not in-process promises: `Promise.all` over service calls
  // batches every read before any rotation commits, which hides the staleness
  // an HTTP client hits the moment a rotation lands between two of its reads.
  async function refreshOverHttp(refreshToken: string): Promise<{
    status: number;
    body: { refreshToken?: string; accessToken?: string; code?: string };
  }> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('x-forwarded-for', uniqueIp())
      .send({ refreshToken });

    return { status: response.status, body: response.body };
  }

  it('never rejects a legitimate refresh when several tabs rotate at once', async () => {
    const pair: TokenPairInterface = await registerUser();

    const settled: PromiseSettledResult<TokenPairInterface>[] = await Promise.allSettled(
      Array.from(
        { length: CONCURRENCY },
        (): Promise<TokenPairInterface> => sessions.refresh(pair.refreshToken),
      ),
    );
    const rejected: PromiseSettledResult<TokenPairInterface>[] = settled.filter(
      (result: PromiseSettledResult<TokenPairInterface>): boolean => result.status === 'rejected',
    );

    expect(rejected).toEqual([]);
  });

  it('hands every concurrent refresher the same live pair', async () => {
    const pair: TokenPairInterface = await registerUser();

    const issued: TokenPairInterface[] = await Promise.all(
      Array.from(
        { length: CONCURRENCY },
        (): Promise<TokenPairInterface> => sessions.refresh(pair.refreshToken),
      ),
    );
    const distinct: Set<string> = new Set(
      issued.map((result: TokenPairInterface): string => result.refreshToken),
    );

    // Exactly one rotation happened; everyone else replayed its result, so no
    // caller is left holding a token that matches neither allowlist key.
    expect(distinct.size).toBe(1);
    await expect(sessions.refresh([...distinct][0] ?? '')).resolves.toMatchObject({
      refreshToken: expect.any(String),
    });
  });

  it('keeps every concurrently issued token usable afterwards', async () => {
    const pair: TokenPairInterface = await registerUser();
    const issued: TokenPairInterface[] = await Promise.all(
      Array.from(
        { length: CONCURRENCY },
        (): Promise<TokenPairInterface> => sessions.refresh(pair.refreshToken),
      ),
    );

    for (const result of issued) {
      await expect(sessions.refresh(result.refreshToken)).resolves.toMatchObject({
        accessToken: expect.any(String),
      });
    }
  });

  // The tripwire must survive the race fix: a token that is neither the
  // current nor the grace key while the session lives is a replay, and it
  // still kills the whole session.
  it('still trips the reuse tripwire for a token superseded twice', async () => {
    const pair: TokenPairInterface = await registerUser();
    const first: TokenPairInterface = await sessions.refresh(pair.refreshToken);
    const second: TokenPairInterface = await sessions.refresh(first.refreshToken);

    // pair.refreshToken is now neither current (second) nor previous (first).
    await expect(sessions.refresh(pair.refreshToken)).rejects.toSatisfy(isRefreshInvalid);

    // …and the tripwire revoked the session, so the honest token dies too.
    await expect(sessions.refresh(second.refreshToken)).rejects.toThrow(UnauthorizedError);
  });

  it('still trips the tripwire when the replay races the legitimate refreshes', async () => {
    const pair: TokenPairInterface = await registerUser();
    const first: TokenPairInterface = await sessions.refresh(pair.refreshToken);
    const second: TokenPairInterface = await sessions.refresh(first.refreshToken);

    const settled: PromiseSettledResult<TokenPairInterface>[] = await Promise.allSettled(
      Array.from(
        { length: CONCURRENCY },
        (): Promise<TokenPairInterface> => sessions.refresh(pair.refreshToken),
      ),
    );

    expect(
      settled.every(
        (result: PromiseSettledResult<TokenPairInterface>): boolean => result.status === 'rejected',
      ),
    ).toBe(true);
    await expect(sessions.refresh(second.refreshToken)).rejects.toThrow(UnauthorizedError);
  });

  // The regression test for the read-side of the race: 12 real concurrent HTTP
  // refreshes per round, chained over many rounds so a rotation gets the chance
  // to land between one request's reads. Every caller must come away holding
  // the one live token — never the token it presented, which is the grace key
  // by then and detonates the tripwire on the next rotation.
  it(
    'never hands an HTTP caller back its own superseded token',
    async () => {
      const start: TokenPairInterface = await registerUser();
      let token: string = start.refreshToken;
      const offendingRounds: number[] = [];

      for (let round = 0; round < HTTP_ROUNDS; round += 1) {
        const presented: string = token;
        const responses = await Promise.all(
          Array.from(
            { length: HTTP_CONCURRENCY },
            (): Promise<{
              status: number;
              body: { refreshToken?: string; accessToken?: string; code?: string };
            }> => refreshOverHttp(presented),
          ),
        );
        const issued: string[] = responses.map(
          (response): string => response.body.refreshToken ?? '',
        );

        expect(responses.every((response): boolean => response.status === 200)).toBe(true);

        if (issued.includes(presented) || new Set(issued).size !== 1) offendingRounds.push(round);

        token = issued.find((candidate: string): boolean => candidate !== presented) ?? presented;
      }

      expect(offendingRounds).toEqual([]);

      // The session is still alive after all that: no tripwire ever fired.
      const final = await refreshOverHttp(token);

      expect(final.status).toBe(200);
    },
    HTTP_RACE_TIMEOUT_MS,
  );

  // Keys written before the `{userId}` hash tag are unreachable by any lookup,
  // but a SCAN on the new pattern alone steps straight past them and leaves
  // them to idle out on their own 30-day TTL. Force-logout has to be total.
  it('sweeps pre-hash-tag allowlist keys on force-logout', async () => {
    const { email } = await registerUserWithEmail();
    const owner: UserWithMethodTypesInterface | null = await users.findByAuthEmail(email);
    const legacyKey: string = `users:${owner?.id}:sessions:legacy-session:refresh`;

    await redis.set(legacyKey, 'a-token-from-before-the-upgrade', 'EX', 3600);
    await sessions.revokeAllForUser(owner?.id ?? '');

    await expect(redis.get(legacyKey)).resolves.toBeNull();
  });
});
