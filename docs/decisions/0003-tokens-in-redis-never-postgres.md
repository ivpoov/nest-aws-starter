# 3. Tokens live in Redis, never in Postgres

Status: accepted

## Context

Any auth system has to answer "is this credential still valid?" on every single request.
The usual implementations put that answer in the relational database: a `refresh_tokens`
table, a `verification_tokens` table, a `revoked_tokens` blacklist. That works, and it
brings three costs with it — a database round trip on the hot path, rows that outlive their
usefulness and need a cleanup job, and revocation that is only as fast as the next query.

The API already runs Redis for throttling, locks and cross-instance pub/sub, so the
alternative store was not a new dependency.

## Decision

Every short-lived credential is a Redis key with a native TTL. Nothing token-shaped is
written to PostgreSQL.

| Credential | Key | Store | Value |
|---|---|---|---|
| Access token | `users:{userId}:sessions:{sessionId}:access` | Redis | SHA-256 digest |
| Refresh token | `users:{userId}:sessions:{sessionId}:refresh` | Redis | SHA-256 digest |
| Rotation grace (replaced token + its replacement) | `users:{userId}:sessions:{sessionId}:refresh:prev` | Redis | digest of the replaced token + the replacing pair **verbatim** |
| Email verification / password reset | `users:{userId}:{kind}` | Redis |
| OAuth `state` | `oauth:state:{state}` | Redis |
| OAuth one-time exchange code | `oauth:exchange:{code}` | Redis |
| Login-failure counters and lockouts | `suspicious:fail…`, `suspicious:lockout…` | Redis |

The braces in `users:{userId}:…` are literal, not placeholder punctuation: they are a Redis
**hash tag**, which pins every key belonging to one user to a single cluster slot. Rotation
compares and rewrites three of those keys in one Lua script, and that is only possible while
they share a slot — without the tag it is a `CROSSSLOT` error the moment `REDIS_IS_CLUSTER`
is on.

Redis is not a cache in front of the truth — it **is** the truth. The comment in
`apps/api/src/modules/token/repositories/token-redis.repository.ts` states the invariant:
"a token exists iff its key exists; revocation is key deletion and applies to access tokens
instantly." A JWT with a valid signature is rejected if its allowlist key is gone.

The session allowlist stores a **SHA-256 digest of the token, never the token**. "Nothing
token-shaped in Postgres" was only half a promise while the refresh token itself sat in
Redis for its full 26-day TTL — a Redis dump, replica or RDB snapshot in a backup bucket was
a pile of directly replayable credentials. A digest answers "is this the token I issued?"
exactly as well, and there is nothing to brute force in a 256-bit random JWT, so the digest
is unsalted and compared in constant time.

The one exception is the rotation grace entry, and it is a real one, stated plainly: it holds
the **live access and refresh token verbatim**, not digests. It has to — its whole job is to
hand the pair that won a refresh race back to the request that lost it, and a digest is
one-way, so there is no way to reconstruct a token from one. The token it *replaced* is stored
only as a digest, and `TokenRedisRepository`'s spec pins exactly which fields the entry may
contain so that this stays a deliberate exception rather than a drift.

So the promise above is precise rather than absolute: a Redis dump is not a pile of replayable
credentials **except** for a rolling window of live pairs, one per session that rotated within
the last `AUTH_REFRESH_GRACE_SEC` (10s by default — sized to a single HTTP round trip, which is
the only overlap it has to cover; see `auth.config.ts` for the derivation). A dump taken inside
that window yields a usable pair, and the refresh token in it stays usable until the session
next rotates. Storing the pair encrypted was considered and rejected: it would only help an
attacker who has the dump but not the app secret, and it puts a new key-management surface and
a new decrypt-failure path on the auth hot path in exchange for narrowing an exposure that is
already bounded, tested and accepted. Revisit it if the grace window ever needs to be long.

One-time tokens are consumed with `GETDEL` (`OneTimeTokenRedisRepository`,
`OauthStoreRedisRepository`), so consumption is atomic and a token cannot be replayed.

Each of these is a normal repository behind a normal contract — `TokenRepositoryInterface`,
`OneTimeTokenRepositoryInterface` — so the choice of store is an implementation detail in
the sense of [ADR 1](./0001-contracts-over-implementations.md).

## Consequences

**Good**

- Expiry is the store's job. There is no `DELETE FROM tokens WHERE expires_at < now()` cron,
  and no table that quietly grows to tens of millions of dead rows.
- Revocation is immediate and applies to **access** tokens, not just refresh tokens —
  `JwtAuthGuard` checks the allowlist on every request, so blocking a user or killing a
  session takes effect on the next call rather than at the end of the access-token TTL.
- "Log out everywhere" is a `SCAN`/`DEL` over one key prefix
  (`TokenRedisRepository.deleteAllForUser`), not a multi-row transaction.
- The auth hot path never touches PostgreSQL.

**Bad — pay these knowingly**

- **Redis becomes a hard availability dependency for authentication.** If Redis is
  unavailable, every authenticated request fails: there is no fallback path that trusts the
  JWT signature alone. This is a deliberate fail-closed choice, and it means Redis needs the
  same operational seriousness as the database. The readiness probe reports `degraded` when
  the Redis ping fails.
- **Redis durability is the auth system's durability.** A flushed or evicted Redis logs
  every user out. The eviction policy must never be one that can drop these keys under
  memory pressure; treat the instance as a datastore, not as a disposable cache.
- **Tokens are invisible to SQL.** "Which sessions were active last Tuesday?" cannot be
  answered by a query, and analytics or forensics over credentials require a separate
  audit trail. That trail exists — the `activities` table, fed by the domain event bus —
  but it is a parallel system, not a join away.
- **Prefix scans are O(keys).** `deleteAllForUser` uses `SCAN … MATCH users:{id}:sessions:*`
  and, in cluster mode, runs it per master node and deletes keys one at a time (multi-key
  `DEL` is `CROSSSLOT`). It is fine at this cardinality and would not be at a much larger one.

**Upgrade step — already spent, delete on sight**

The release that introduced digests shipped a compatibility shim,
`TokenRedisRepository.matchesPreDigestKey`, which accepts an allowlist key still holding a
verbatim token, rewrites it as a digest with `SET … KEEPTTL`, and lets that request through.
Its purpose was to avoid signing every logged-in user out on the digest deploy.

**It no longer serves that purpose, and it is dead now rather than on a schedule.** The same
release cycle also added the `{userId}` hash tag, which *renames* every session key. A raw,
pre-digest value can only ever sit under the old untagged name, and no lookup builds that name
any more — so the shim guards a state the current key layout cannot produce, and every
pre-existing session ends at deploy regardless of whether the shim is present. The two
compatibility mechanisms are mutually exclusive and the hash tag wins.

That cost nothing to accept: this repository had never been deployed by anyone when the rename
landed, so there were no live sessions to preserve. It is recorded here, and in the comment on
`TokenRedisRepository.accessKey`, so a later reader knows the continuity was given up for free
rather than weighed against real users.

**Delete `matchesPreDigestKey`, its `isDigest` guard and their tests whenever convenient — no
waiting window applies.** Delete the second SCAN pattern in `deleteAllForUser` at the same
time: it exists only to sweep those same untagged keys so they are not left to idle out, and
the two have exactly the same lifetime. Nothing breaks if they are left in place; they are dead
weight that invites the question "when is a non-digest accepted?" every time someone reads the
file.

**Where it is bent — and why the bend is intentional**

The rule is about *tokens*, not about *everything auth-adjacent*. Two things do live in
PostgreSQL:

- **`sessions`** (`apps/api/prisma/schema.prisma`). The row holds session *metadata* —
  device string, IP, `createdAt`, `lastActiveAt`, `activeUntil`, `signedAsAdminId` — because
  the session list is a user-facing, paginated, auditable screen. No token material is in
  it. The token keys are namespaced by the session's id, so the Postgres row is the
  descriptor and Redis holds the credential.
  The schema comment claims "a session is alive iff its Redis refresh key exists", but the
  code is stricter than that: `SessionService` also rejects a refresh when the Postgres row
  is missing or `activeUntil` has passed — "Explicit liveness gate, independent of 'the
  Redis key still existed'". Session *lifetime* is therefore dual-sourced even though token
  *material* is not.
- **`api_keys`.** Long-lived API keys are stored as `hashedKey` plus a display `prefix`.
  These are not session tokens: they are user-managed, revocable-by-name resources with an
  admin UI and a `lastUsedAt` column, and they must survive a Redis flush. A key is verified
  against the hash in PostgreSQL, not against a Redis allowlist. They have no TTL at all —
  revocation is a soft delete (`revokedAt`), so the "expiry is the store's job" benefit does
  not apply to them.

Password hashes (`auth_methods.passwordHash`, Argon2) are of course also in PostgreSQL. The
rule is "no *tokens* in Postgres", not "no secrets in Postgres".
