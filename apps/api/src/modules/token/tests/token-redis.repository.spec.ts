import { createHash } from 'node:crypto';
import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';
import { TokenRedisRepository } from '@modules/token/repositories/token-redis.repository.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { describe, expect, it } from 'vitest';

// A JWT-shaped string: what actually goes into the allowlist, so a test that
// asserts "the stored value is not this" is asserting the real thing.
const ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJzZXNzaW9uSWQiOiJzZXNzLTEifQ.aaaaaaaaaaaaaaaaaaaa';
const REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJzZXNzaW9uSWQiOiJzZXNzLTEifQ.bbbbbbbbbbbbbbbbbbbb';
const ROTATED_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJzZXNzaW9uSWQiOiJzZXNzLTEifQ.cccccccccccccccccccc';

const REFRESH_KEY = 'users:user-1:sessions:sess-1:refresh';
const ACCESS_KEY = 'users:user-1:sessions:sess-1:access';
const GRACE_KEY = 'users:user-1:sessions:sess-1:refresh:prev';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Minimal Redis stand-in: the repository only needs GET/SET/DEL here, and the
// TTL argument is recorded rather than honoured so a test can assert it.
class FakeRedis {
  public readonly values: Map<string, string> = new Map();
  public readonly ttlSecByKey: Map<string, number> = new Map();
  public readonly setModes: string[] = [];

  public async set(key: string, value: string, mode?: string, ttlSec?: number): Promise<'OK'> {
    this.values.set(key, value);
    this.setModes.push(mode ?? '');

    if (mode === 'EX' && ttlSec !== undefined) this.ttlSecByKey.set(key, ttlSec);

    return 'OK';
  }

  public async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  public async del(...keys: string[]): Promise<number> {
    let removed = 0;

    for (const key of keys) if (this.values.delete(key)) removed += 1;

    return removed;
  }
}

function createRepository(): { repository: TokenRedisRepository; redis: FakeRedis } {
  const redis = new FakeRedis();

  return {
    repository: new TokenRedisRepository(redis as unknown as RedisClientType),
    redis,
  };
}

describe('TokenRedisRepository', () => {
  // The bug this guards: a refresh token sat in Redis verbatim for the whole
  // refresh TTL, so anything that could read Redis held directly replayable
  // credentials. Asserting "not equal to the token" is the point — asserting
  // only "equals the digest" would still pass if the digest were the token.
  it('stores a digest of the refresh token, never the token', async () => {
    const { repository, redis } = createRepository();

    await repository.setRefreshToken('user-1', 'sess-1', REFRESH_TOKEN, 2_592_000);

    const stored: string = redis.values.get(REFRESH_KEY) ?? '';

    expect(stored).not.toBe(REFRESH_TOKEN);
    expect(stored).not.toContain(REFRESH_TOKEN);
    expect(stored).toBe(sha256(REFRESH_TOKEN));
    expect(redis.ttlSecByKey.get(REFRESH_KEY)).toBe(2_592_000);
  });

  it('stores a digest of the access token, never the token', async () => {
    const { repository, redis } = createRepository();

    await repository.setAccessToken('user-1', 'sess-1', ACCESS_TOKEN, 900);

    expect(redis.values.get(ACCESS_KEY)).toBe(sha256(ACCESS_TOKEN));
    expect(redis.values.get(ACCESS_KEY)).not.toBe(ACCESS_TOKEN);
  });

  it('matches the token it stored and rejects any other', async () => {
    const { repository } = createRepository();

    await repository.setRefreshToken('user-1', 'sess-1', REFRESH_TOKEN, 60);

    expect(await repository.matchesRefreshToken('user-1', 'sess-1', REFRESH_TOKEN)).toBe(true);
    expect(await repository.matchesRefreshToken('user-1', 'sess-1', ROTATED_REFRESH_TOKEN)).toBe(
      false,
    );
  });

  // Revocation is key deletion, and it has to keep working now that the value
  // is a digest — this is the force-logout path.
  it('stops matching once the session keys are deleted', async () => {
    const { repository } = createRepository();

    await repository.setRefreshToken('user-1', 'sess-1', REFRESH_TOKEN, 60);
    await repository.setAccessToken('user-1', 'sess-1', ACCESS_TOKEN, 60);
    await repository.deleteAllForSession('user-1', 'sess-1');

    expect(await repository.matchesRefreshToken('user-1', 'sess-1', REFRESH_TOKEN)).toBe(false);
    expect(await repository.matchesAccessToken('user-1', 'sess-1', ACCESS_TOKEN)).toBe(false);
  });

  it('deletes the rotation grace key along with the session', async () => {
    const { repository, redis } = createRepository();

    await repository.setRotationGrace(
      'user-1',
      'sess-1',
      REFRESH_TOKEN,
      { accessToken: ACCESS_TOKEN, refreshToken: ROTATED_REFRESH_TOKEN },
      30,
    );
    await repository.deleteAllForSession('user-1', 'sess-1');

    expect(redis.values.has(GRACE_KEY)).toBe(false);
  });

  // The grace window keys the replay by the digest of the replaced token, so
  // the reuse tripwire still sees "presented a token that is neither current
  // nor the one just replaced" for everything else.
  it('replays the issued pair for the replaced token only', async () => {
    const { repository } = createRepository();
    const issued: RotationGracePairInterface = {
      accessToken: ACCESS_TOKEN,
      refreshToken: ROTATED_REFRESH_TOKEN,
    };

    await repository.setRotationGrace('user-1', 'sess-1', REFRESH_TOKEN, issued, 30);

    expect(await repository.findRotationGraceReplay('user-1', 'sess-1', REFRESH_TOKEN)).toEqual(
      issued,
    );
    expect(
      await repository.findRotationGraceReplay('user-1', 'sess-1', ROTATED_REFRESH_TOKEN),
    ).toBeNull();
  });

  it('does not store the replaced token in the grace key', async () => {
    const { repository, redis } = createRepository();

    await repository.setRotationGrace(
      'user-1',
      'sess-1',
      REFRESH_TOKEN,
      { accessToken: ACCESS_TOKEN, refreshToken: ROTATED_REFRESH_TOKEN },
      30,
    );

    expect(redis.values.get(GRACE_KEY)).not.toContain(REFRESH_TOKEN);
    expect(redis.ttlSecByKey.get(GRACE_KEY)).toBe(30);
  });

  it('reports no replay when no rotation grace key exists', async () => {
    const { repository } = createRepository();

    expect(await repository.findRotationGraceReplay('user-1', 'sess-1', REFRESH_TOKEN)).toBeNull();
  });

  // Deploy compatibility: keys written by the previous release hold the token
  // verbatim. They keep working once, and are rewritten as digests in place.
  it('accepts a pre-digest key and upgrades it in place, keeping its ttl', async () => {
    const { repository, redis } = createRepository();

    redis.values.set(REFRESH_KEY, REFRESH_TOKEN);

    expect(await repository.matchesRefreshToken('user-1', 'sess-1', REFRESH_TOKEN)).toBe(true);
    expect(redis.values.get(REFRESH_KEY)).toBe(sha256(REFRESH_TOKEN));
    expect(redis.setModes).toContain('KEEPTTL');
  });

  // Without the "already digested" guard the fallback compares the stored
  // digest to whatever was presented, so presenting the digest itself matches
  // and rewrites the key to sha256(digest) — the genuine token is then dead
  // for the life of that session. Unreachable through the API (the JWT
  // signature is verified first) but bricking, so it is guarded and pinned.
  it('never treats a stored digest as a pre-digest key', async () => {
    const { repository, redis } = createRepository();

    await repository.setRefreshToken('user-1', 'sess-1', REFRESH_TOKEN, 60);

    const digest: string = redis.values.get(REFRESH_KEY) ?? '';

    expect(await repository.matchesRefreshToken('user-1', 'sess-1', digest)).toBe(false);
    // The key is untouched, so the real token still works.
    expect(redis.values.get(REFRESH_KEY)).toBe(digest);
    expect(await repository.matchesRefreshToken('user-1', 'sess-1', REFRESH_TOKEN)).toBe(true);
  });

  it('still rejects a wrong token against a pre-digest key', async () => {
    const { repository, redis } = createRepository();

    redis.values.set(REFRESH_KEY, REFRESH_TOKEN);

    expect(await repository.matchesRefreshToken('user-1', 'sess-1', ROTATED_REFRESH_TOKEN)).toBe(
      false,
    );
    expect(redis.values.get(REFRESH_KEY)).toBe(REFRESH_TOKEN);
  });

  it('treats a pre-format grace key as no replay rather than throwing', async () => {
    const { repository, redis } = createRepository();

    redis.values.set(GRACE_KEY, REFRESH_TOKEN);

    expect(await repository.findRotationGraceReplay('user-1', 'sess-1', REFRESH_TOKEN)).toBeNull();
  });
});
