import { createHash, timingSafeEqual } from 'node:crypto';
import type { RotateTokensDataInterface } from '@modules/token/interfaces/rotate-tokens-data.interface.js';
import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';
import type { RotationStateInterface } from '@modules/token/interfaces/rotation-state.interface.js';
import type { TokenRepositoryInterface } from '@modules/token/interfaces/token-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@providers/redis/constants/redis.constants.js';
import type { RedisClientType } from '@providers/redis/types/redis-client.type.js';
import { Cluster, type Redis } from 'ioredis';

// KEYS: access, refresh, grace. ARGV: expected refresh digest, grace entry,
// new refresh digest, refresh ttl, grace ttl, new access digest, access ttl.
// Bails out without writing anything unless the presented token is still the
// current one, so two concurrent refreshes can never both rotate.
const ROTATE_SCRIPT: string = `
if redis.call("get", KEYS[2]) ~= ARGV[1] then
  return 0
end
redis.call("set", KEYS[3], ARGV[2], "EX", ARGV[5])
redis.call("set", KEYS[2], ARGV[3], "EX", ARGV[4])
redis.call("set", KEYS[1], ARGV[6], "EX", ARGV[7])
return 1
`;

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
// The one exception is the rotation grace entry, which has to hand back the
// pair that replaced a token — see rotateTokens.
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

  public matchesAccessToken(userId: string, sessionId: string, token: string): Promise<boolean> {
    return this.matches(this.accessKey(userId, sessionId), token);
  }

  // MGET is a single command, so the refresh key and the grace entry are read
  // from one consistent state of the keyspace — a rotation can land before it
  // or after it, never between the two reads. That is the whole point: reading
  // them separately let a rotation commit in between, leaving the caller to
  // decide against a state that had already moved on, which is how an honest
  // second tab got mistaken for a token thief and logged everyone out.
  public async readRotationState(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<RotationStateInterface> {
    const refreshKey: string = this.refreshKey(userId, sessionId);
    const [storedRefresh, rawGrace]: (string | null)[] = await this.redis.mget(
      refreshKey,
      this.rotationGraceKey(userId, sessionId),
    );

    return {
      isCurrent: await this.matchesStored(refreshKey, storedRefresh ?? null, token),
      replay: this.readGraceReplay(rawGrace ?? null, token),
    };
  }

  // Compare-and-swap. Redis runs a script to completion with nothing
  // interleaved, so a concurrent refresher observes either the whole old state
  // or the whole new one — never a half-rotated session whose current key has
  // already been replaced with no grace entry recorded yet. The compare is
  // what keeps the reuse tripwire honest: exactly one caller can win the swap,
  // and losing it is reported as a lost race rather than a valid rotation.
  //
  // The grace entry is the one place a token is stored rather than digested,
  // and the narrowest available: two clients refreshing at once must end up
  // holding the same pair, so the winner's pair has to be replayable to the
  // loser. It is scoped to one session, keyed by the digest of the token it
  // replaced, and dies with the grace window.
  //
  // Only digests are compared inside the script, never tokens. A digest is not
  // a credential — forging one needs a preimage, and TokenService verifies the
  // JWT signature long before this runs — so the script's plain,
  // non-constant-time compare leaks nothing worth having. Every comparison
  // reachable with an attacker-chosen value still goes through equals().
  public async rotateTokens(data: RotateTokensDataInterface): Promise<boolean> {
    const grace: string = JSON.stringify({
      replacedDigest: this.digest(data.expectedRefreshToken),
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    const swapped: unknown = await this.redis.eval(
      ROTATE_SCRIPT,
      3,
      this.accessKey(data.userId, data.sessionId),
      this.refreshKey(data.userId, data.sessionId),
      this.rotationGraceKey(data.userId, data.sessionId),
      this.digest(data.expectedRefreshToken),
      grace,
      this.digest(data.refreshToken),
      String(data.refreshTtlSec),
      String(data.graceTtlSec),
      this.digest(data.accessToken),
      String(data.accessTtlSec),
    );

    return swapped === 1;
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
    return this.matchesStored(key, await this.redis.get(key), token);
  }

  // Split from the fetch so readRotationState can apply exactly the same rules
  // to a value it already holds, without spending a second round trip on it.
  private async matchesStored(key: string, stored: string | null, token: string): Promise<boolean> {
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

  private readGraceReplay(raw: string | null, token: string): RotationGracePairInterface | null {
    if (raw === null) return null;

    const entry: Record<string, unknown> | null = this.parseGrace(raw);

    if (!entry) return null;
    if (typeof entry.replacedDigest !== 'string') return null;
    if (typeof entry.accessToken !== 'string' || typeof entry.refreshToken !== 'string') {
      return null;
    }
    if (!this.equals(entry.replacedDigest, this.digest(token))) return null;

    return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
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
