# 2. Fastify, not Express

Status: accepted

## Context

NestJS is transport-agnostic and ships two HTTP adapters. Express is the default and the one
every tutorial, every Stack Overflow answer and most third-party Nest packages assume.
Fastify is the alternative: faster JSON serialization, a schema-first request pipeline, and an
explicit plugin/hook lifecycle instead of an ordered middleware array.

For a starter whose whole job is to serve JSON to two SPAs and a set of API clients, the
serialization path is the hot path, and there is no server-rendered HTML, no template engine
and no static asset serving to keep on the Express side.

## Decision

Fastify. `@nestjs/platform-fastify` is the only adapter in the tree — there is no `express`,
no `@nestjs/platform-express` and no `@types/express` in any `package.json`.

The adapter is constructed by hand in `apps/api/src/main.ts` rather than left to Nest,
because two things must be decided before Nest exists:

- `trustProxy` has to be set at adapter-construction time, which is why `.env` is loaded
  before the adapter rather than by `ConfigModule`.
- A raw `onRequest` hook installs the `X-Request-Id` header and opens the `AsyncLocalStorage`
  scope that every log line reads from.

Response headers come from `@fastify/helmet`, registered once in
`registerSecurityHeaders()`. Everything else in the pipeline is Nest-native and
adapter-independent: CORS via `app.enableCors`, rate limiting via `@nestjs/throttler` with a
Fastify-aware `getTracker` override, validation via `ValidationPipe`.

## Consequences

**Good**

- Faster JSON encode/decode and lower per-request overhead on a workload that is essentially
  all JSON.
- The hook lifecycle is explicit and typed. `onRequest`, `onSend` and plugin boot ordering are
  things you reason about deliberately instead of discovering through middleware ordering
  bugs.
- `@fastify/helmet` keeps the security-header *values* — HSTS preload rules, the CSP directive
  set, headers browsers have retired — tracked upstream under a CVE process, rather than in a
  hand-written hook in this repository that would silently age.

**Bad — pay these knowingly**

- **The adapter is not encapsulated.** `import type { FastifyRequest } from 'fastify'`
  appears in 16 framework-adjacent files: guards, decorators, the exception filter,
  controllers. Reversing this decision is not an adapter swap, it is a 16-file change.
- **A phantom dependency exists only to make Swagger work.** `@fastify/static` is a direct
  dependency of `apps/api` that no source file imports. It is there to satisfy an optional
  peer of `@nestjs/platform-fastify`, which `SwaggerModule.setup()` needs in order to serve
  the Swagger UI assets. On Express, Nest serves them with no extra package.
- **`rawBody` is application-wide, not per route.** Stripe's signature verification needs the
  exact received bytes. Express would express this as a per-route
  `express.raw({ type: 'application/json' })` mount; NestJS's `rawBody` is a bootstrap
  option, so **every** route in the application buffers its body so that one webhook
  controller can read it. The comment in `main.ts` says so explicitly.
- **Swagger's basic auth and its CSP relaxation are hand-rolled Fastify hooks.** There is no
  `express-basic-auth` equivalent, so `setup-swagger.helper.ts` implements the check itself
  (with a `timingSafeEqual` over SHA-256 digests) and relaxes the CSP in an `onSend` hook.
  The file documents the lifecycle hazard that forced the choice: helmet writes the API-wide
  policy from an `onRequest` hook registered *by a plugin*, and plugin hooks land during
  Fastify's boot — after this file's synchronous `addHook` calls — so ordering within the
  `onRequest` phase would be wrong. That class of problem does not exist in Express.
- **Every test bootstrap needs an extra await.** `await app.getHttpAdapter().getInstance().ready()`
  in `test/app.factory.ts` has no Express counterpart; without it, supertest races Fastify's
  async plugin boot. Even a pure unit spec has to name the adapter.
- **Extra supply-chain pins.** `find-my-way` (Fastify's router) and `@fastify/static` both
  carry version overrides in `pnpm-workspace.yaml` that an Express project would not have.

**Where it was routed around rather than solved**

Nest's file-upload stack — `FileInterceptor`, `@UploadedFile`, `MulterModule` — is
Express-only. This repository does not port it and does not register `@fastify/multipart`
either: it uses client-direct presigned S3 uploads instead (`requestUpload` issues a presigned
PUT and writes a `PENDING` row, `confirmUpload` HEAD-verifies the object and flips it to
`READY`). That design is defensible on its own merits — no bytes flow through the API, which
is also why `Cross-Origin-Resource-Policy: same-origin` is safe — but be clear that the
Express-only path was avoided, not replaced. It has its own cost: an
`OrphanFileSweepJob` exists purely to reconcile uploads a client never confirmed.
