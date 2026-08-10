import { createHash, timingSafeEqual } from 'node:crypto';
import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, type Redis } from 'ioredis';

// The Redis allowlist IS the source of token truth: a token exists iff its key
// exists; revocation is key deletion and applies to access tokens instantly.
//
// What is stored is a SHA-256 digest of the token, never the token. The
// allowlist only ever has to answer "is this the token I issued?", which a
// digest answers exactly as well — and a refresh token lives here for the
// whole refresh TTL (26 days by default), so storing it verbatim meant a
// Redis dump, a replica, an RDB snapshot in a backup bucket or a misconfigured
// `redis-cli` was a pile of directly replayable credentials. The schema's
// promise that no token material lives in Postgres was true and beside the
// point while it all lived here instead.
//
// SHA-256 with no salt or stretching is the right primitive: these are
// 256-bit-entropy random JWTs, not passwords, so there is nothing to brute
// force and a per-key salt would buy nothing but a second round trip. The
// digest is what makes the store non-replayable; the comparison is
// constant-time so the lookup cannot be turned into an oracle.
//
// The one exception is the rotation grace key, which has to hand back the
// pair that replaced a token — see setRotationGrace.
@Injectable()
export class TokenRedisRepository implements TokenRepositoryInterface {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClientType) {}

  public async setAccessToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(this.accessKey(userId, sessionId), this.digest(token), 'EX', ttlSec);
  }

  public async setRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void> {
    await this.redis.set(this.refreshKey(userId, sessionId), this.digest(token), 'EX', ttlSec);
  }

  // The only place a token is stored rather than digested, and the narrowest
  // one available: two clients refreshing at once must both end up holding the
  // same pair, so the pair that won the race has to be replayable to the
  // loser. It is scoped to a single session, keyed by the digest of the token
  // being replaced, and expires with the grace window — 30 seconds by default,
  // against the 26 days the refresh allowlist used to hold a live token for.
  public async setRotationGrace(
    userId: string,
    sessionId: string,
    replacedToken: string,
    issued: RotationGracePairInterface,
    ttlSec: number,
  ): Promise<void> {
    const payload: string = JSON.stringify({
      replacedDigest: this.digest(replacedToken),
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
    });

    await this.redis.set(this.rotationGraceKey(userId, sessionId), payload, 'EX', ttlSec);
  }

  public matchesAccessToken(userId: string, sessionId: string, token: string): Promise<boolean> {
    return this.matches(this.accessKey(userId, sessionId), token);
  }

  public matchesRefreshToken(userId: string, sessionId: string, token: string): Promise<boolean> {
    return this.matches(this.refreshKey(userId, sessionId), token);
  }

  public async findRotationGraceReplay(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<RotationGracePairInterface | null> {
    const raw: string | null = await this.redis.get(this.rotationGraceKey(userId, sessionId));

    if (raw === null) return null;

    const entry: {
      replacedDigest?: unknown;
      accessToken?: unknown;
      refreshToken?: unknown;
    } | null = this.parseGrace(raw);

    if (!entry) return null;
    if (typeof entry.replacedDigest !== 'string') return null;
    if (typeof entry.accessToken !== 'string' || typeof entry.refreshToken !== 'string')
      return null;
    if (!this.equals(entry.replacedDigest, this.digest(token))) return null;

    return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
  }

  public async deleteAllForSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(
      this.accessKey(userId, sessionId),
      this.refreshKey(userId, sessionId),
      this.rotationGraceKey(userId, sessionId),
    );
  }

  // Force-logout must be total, so it sweeps the pre-hash-tag key layout as
  // well. Those keys are unreachable by any lookup (see accessKey for why that
  // was chosen), but unreachable is not the same as gone: without the second
  // pattern a SCAN steps straight past them and leaves them to idle out on
  // their own refresh TTL. Dropping them from lookup is deliberate; leaving
  // them lying around silently is not. Droppable together with
  // matchesPreDigestKey, on the same schedule.
  public async deleteAllForUser(userId: string): Promise<void> {
    const patterns: string[] = [`users:{${userId}}:sessions:*`, `users:${userId}:sessions:*`];

    if (this.redis instanceof Cluster) {
      const masters: Redis[] = this.redis.nodes('master');

      await Promise.all(
        masters.flatMap((node: Redis): Promise<void>[] =>
          patterns.map(
            (pattern: string): Promise<void> => this.deleteByPatternOnNode(node, pattern),
          ),
        ),
      );

      return;
    }

    for (const pattern of patterns) {
      await this.deleteByPatternOnNode(this.redis, pattern);
    }
  }

  private async matches(key: string, token: string): Promise<boolean> {
    const stored: string | null = await this.redis.get(key);

    if (stored === null) return false;
    if (this.equals(stored, this.digest(token))) return true;

    // A digested key is done: it can only ever be matched by digest. Falling
    // through would compare the stored digest to the presented string, so
    // presenting the digest itself as the token would "match" and rewrite the
    // key to sha256(digest) — permanently bricking the real token for that
    // session. Not reachable from outside (TokenService verifies the JWT
    // signature first, and a hex digest is not a signed JWT), which is why it
    // is a correctness guard rather than a vulnerability fix.
    if (this.isDigest(stored)) return false;

    return this.matchesPreDigestKey(key, stored, token);
  }

  // Compatibility shim for allowlist keys written before this repository
  // digested anything: they hold the token verbatim. Accepting one — and
  // rewriting it as a digest with its remaining TTL intact — is what stops the
  // deploy that ships digesting from signing every logged-in user out.
  //
  // DELETE ME once one AUTH_REFRESH_TTL_SEC window (26 days by default) has
  // passed since that deploy: no pre-digest key can exist after that and this
  // is pure dead weight. Grep `matchesPreDigestKey`; the removal step is also
  // written down in docs/decisions/0003-tokens-in-redis-never-postgres.md so
  // it is on the page an operator actually reads rather than only in here.
  private async matchesPreDigestKey(key: string, stored: string, token: string): Promise<boolean> {
    if (!this.equals(stored, token)) return false;

    await this.redis.set(key, this.digest(token), 'KEEPTTL');

    return true;
  }

  private isDigest(value: string): boolean {
    return /^[0-9a-f]{64}$/.test(value);
  }

  private parseGrace(raw: string): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(raw);

      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      // A grace key written before this format existed. It cannot be replayed
      // (it held only the replaced token, not its replacement), so the caller
      // falls through to the normal current-token check.
      return null;
    }
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private equals(left: string, right: string): boolean {
    const leftBytes: Buffer = Buffer.from(left);
    const rightBytes: Buffer = Buffer.from(right);

    // timingSafeEqual throws on a length mismatch, and the lengths are not
    // secret — a digest is always 64 hex characters.
    if (leftBytes.length !== rightBytes.length) return false;

    return timingSafeEqual(leftBytes, rightBytes);
  }

  private async deleteByPatternOnNode(node: Redis, pattern: string): Promise<void> {
    let cursor: string = '0';

    do {
      const [nextCursor, keys]: [string, string[]] = await node.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );

      // One by one: multi-key DEL is CROSSSLOT in cluster mode.
      await Promise.all(keys.map((key: string): Promise<number> => node.del(key)));
      cursor = nextCursor;
    } while (cursor !== '0');
  }

  // The `{userId}` hash tag pins every key of one user to a single cluster
  // slot. Without it the rotation script below — and the multi-key DEL in
  // deleteAllForSession — are CROSSSLOT errors the moment REDIS_IS_CLUSTER is
  // on, and rotation cannot be made atomic at all.
  //
  // Renaming the keys means no lookup can reach a pre-tag key, so every
  // session that existed before this change ends at deploy and its owner logs
  // in once more. That was deliberate, and the cost of it was literally zero
  // when it was made: this repository had never been deployed by anyone — it
  // was a pre-publication starter with no installations, so there were no live
  // sessions to weigh. Recorded here so a later reader deciding whether to add
  // a legacy-key lookup path knows the continuity was given up for free, not
  // traded away against real users. It is still the right trade if you have
  // them: reaching a legacy key costs a second Redis round trip inside
  // refresh(), and refresh() reading more than once is the precise shape that
  // force-logged legitimate users out — see readRotationState.
  private accessKey(userId: string, sessionId: string): string {
    return `users:{${userId}}:sessions:${sessionId}:access`;
  }

  private refreshKey(userId: string, sessionId: string): string {
    return `users:{${userId}}:sessions:${sessionId}:refresh`;
  }

  // Same suffix the previous-refresh-token grace window used, under the tagged
  // name — deleteAllForUser sweeps the untagged layout, so nothing is left
  // orphaned under the old one either.
  private rotationGraceKey(userId: string, sessionId: string): string {
    return `users:{${userId}}:sessions:${sessionId}:refresh:prev`;
  }
}
