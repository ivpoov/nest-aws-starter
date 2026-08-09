# 1. Depend on contracts, never on implementations

Status: accepted

## Context

The API is a NestJS application on Prisma and PostgreSQL. Prisma's generated client is
extremely convenient: it gives every call site a fully typed `findMany({ where, include,
orderBy })` and a model type per table. Convenience is exactly the problem. Once a service
accepts or returns a Prisma model, or composes a `where` clause, the ORM's shape becomes
the application's shape — and it spreads, because every new feature has an easy reason to
reach one layer further down.

The starter is meant to be forked and kept for years. It needs a boundary that survives
contributors who have never read this file.

## Decision

Layers communicate through interfaces only.

- A service depends on a **repository contract** (`NoteRepositoryInterface`) injected under
  a `Symbol` token, never on a concrete class:
  `apps/api/src/modules/note/constants/note.constants.ts` declares
  `export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');`, and
  `note.module.ts` binds it with `{ provide: NOTE_REPOSITORY, useClass: NotePrismaRepository }`.
- The **only** files allowed to import the generated Prisma client are `*-prisma.repository.ts`
  (plus the TypedSQL repository and `modules/prisma/**`). Repositories map rows to domain
  interfaces in a private `toDomain()` and never return an ORM model.
- Repositories expose **named, intention-revealing methods** (`findManyAfter(userId,
  pagination)`), not query pass-throughs. A new query shape means a new method on the
  contract.
- **Modules export services only.** Repositories and their tokens are module-private. A
  module that needs another module's data calls its service or subscribes to a domain event.

The rule is stated in `docs/conventions/backend.md` §1, §5 and §6, and the `note` module is
its reference implementation.

The acceptance test the convention states for any design question: *could Prisma/PostgreSQL
be replaced by writing new repository implementations only, touching zero services, zero
controllers, zero contracts?*

## Consequences

**Good**

- Swapping the persistence layer, or putting one entity behind a different store, is a
  localized change. `TokenRedisRepository`, `OneTimeTokenRedisRepository` and
  `LockoutRedisRepository` are ordinary repositories behind ordinary contracts — nothing in
  the services above them knows they are not SQL.
- Services are unit-testable with a hand-written fake object; no Prisma mock, no test database.
- Errors stay transport- and ORM-agnostic: `NotePrismaRepository` translates Prisma's `P2025`
  into `null`/`false` at the boundary, and the service turns that into a domain
  `NotFoundError`.

**Bad — pay these knowingly**

- **Boilerplate per entity.** A domain object costs a domain interface, a repository
  interface, a token, an implementation, and a `toDomain()` mapper before the first feature
  line is written. For a table with 12 columns this is real, repeated typing.
- **No ad-hoc queries.** `include`, `select` and composed `where` clauses cannot be assembled
  by a caller, so contracts accumulate narrow methods over time. Anything genuinely
  query-shaped ends up as a hand-written TypedSQL statement in `apps/api/prisma/sql/`
  (`StatisticTypedSqlRepository`) rather than as a clever call site.
- **Cross-module joins are impossible by construction.** Because repositories are
  module-private, a query spanning two modules must be split into two service calls, which
  is more round trips than one SQL join would be. The dashboard aggregates get a Redis cache
  in front of them for exactly this reason.
- **Enforced by review, not by tooling.** There is no lint rule and no CI check pinning the
  Prisma import boundary today — `biome.json` has no `noRestrictedImports` for it. The
  invariant currently holds (`grep -rl '@generated/prisma' apps/api/src` returns only
  repositories and `modules/prisma/`), but nothing stops the next commit from breaking it.
  Worse, the convention text says the forbidden specifier is `@prisma/client`, while this
  repo generates its client into `apps/api/src/generated/prisma` and imports it as
  `@generated/prisma/*` — a rule written against the documented specifier would match
  nothing.

**Where it is already bent**

- `HealthService` injects `PrismaService` directly and runs a raw
  ``$queryRaw`SELECT 1` `` for the readiness probe
  (`apps/api/src/modules/health/services/health.service.ts`). It is a liveness ping, not a
  domain read, and it deliberately skips the repository layer — but it is a service holding
  an ORM handle, and the convention does not carve out an exception for it.
