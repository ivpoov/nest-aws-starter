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
    if (typeof entry.accessToken !== 'string' || typeof entry.refreshToken !== 'string') return null;
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

  public async deleteAllForUser(userId: string): Promise<void> {
    if (this.redis instanceof Cluster) {
      const masters: Redis[] = this.redis.nodes('master');

      await Promise.all(
        masters.map((node: Redis): Promise<void> => this.deleteByPatternOnNode(node, userId)),
      );

      return;
    }

    await this.deleteByPatternOnNode(this.redis, userId);
  }

  private async matches(key: string, token: string): Promise<boolean> {
    const stored: string | null = await this.redis.get(key);

    if (stored === null) return false;
    if (this.equals(stored, this.digest(token))) return true;

    // Keys written before this repository started digesting hold the token
    // verbatim. Accepting one — and immediately rewriting it as a digest,
    // keeping its remaining TTL — is what stops the deploy that ships this
    // from signing every logged-in user out. Safe to delete once one refresh
    // TTL (AUTH_REFRESH_TTL_SEC) has passed since that deploy, after which no
    // such key can still exist.
    if (!this.equals(stored, token)) return false;

    await this.redis.set(key, this.digest(token), 'KEEPTTL');

    return true;
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

  private async deleteByPatternOnNode(node: Redis, userId: string): Promise<void> {
    let cursor: string = '0';

    do {
      const [nextCursor, keys]: [string, string[]] = await node.scan(
        cursor,
        'MATCH',
        `users:${userId}:sessions:*`,
        'COUNT',
        100,
      );

      // One by one: multi-key DEL is CROSSSLOT in cluster mode.
      await Promise.all(keys.map((key: string): Promise<number> => node.del(key)));
      cursor = nextCursor;
    } while (cursor !== '0');
  }

  private accessKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:access`;
  }

  private refreshKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:refresh`;
  }

  // Same key the previous-refresh-token grace window used, so a deploy does
  // not leave an orphaned key behind under the old name.
  private rotationGraceKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:refresh:prev`;
  }
}
