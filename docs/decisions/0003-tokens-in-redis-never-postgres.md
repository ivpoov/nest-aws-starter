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

| Credential | Key | Store |
|---|---|---|
| Access token | `users:{userId}:sessions:{sessionId}:access` | Redis |
| Refresh token | `users:{userId}:sessions:{sessionId}:refresh` | Redis |
| Previous refresh token (rotation grace) | `users:{userId}:sessions:{sessionId}:refresh:prev` | Redis |
| Email verification / password reset | `users:{userId}:{kind}` | Redis |
| OAuth `state` | `oauth:state:{state}` | Redis |
| OAuth one-time exchange code | `oauth:exchange:{code}` | Redis |
| Login-failure counters and lockouts | `suspicious:fail…`, `suspicious:lockout…` | Redis |

Redis is not a cache in front of the truth — it **is** the truth. The comment in
`apps/api/src/modules/token/repositories/token-redis.repository.ts` states the invariant:
"a token exists iff its key exists; revocation is key deletion and applies to access tokens
instantly." A JWT with a valid signature is rejected if its allowlist key is gone.

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
