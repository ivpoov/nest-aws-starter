# nest-aws-starter

AWS-native, production-grade NestJS + React full-stack starter.

> **Current release line: v0.5 "Notifications".** The API, both React
> frontends, auth & identity, admin operations, payments and real-time
> notifications are all in the tree — the API with unit *and* e2e tests, the
> frontends with unit tests. Shipped so
> far: v0.1 foundation, v0.2 auth & identity, v0.3 admin & user ops, v0.4
> payments, v0.5 notifications. Full prose documentation is still a v1.0
> task — until then `docs/conventions/backend.md` and the generated recipes
> in `docs/removal/` are the authoritative references.

## What's inside

- **API core** — controller → service → repository layering, coded
  transport-agnostic errors, health probes, Swagger, request throttling,
  structured logging, and scheduled maintenance tasks.
- **Auth & identity** — email/password with verification and reset, OAuth
  login *and* account linking (Google, Facebook, Discord), refresh-token
  sessions with revocation, long-lived API keys, CASL permissions,
  login lockout and new-device alerts.
- **Admin & user ops** — role-gated admin console, user management with
  block/unblock and `login-as` impersonation, an activity audit trail, a
  contact-form inbox, and S3 presigned uploads with optional CloudFront
  signed URLs.
- **Payments** — Stripe-backed plans, checkout, subscriptions, billing
  portal, transaction history, webhook processing drained through SQS, and
  revenue statistics.
- **Notifications** — persist-first domain-event notifications delivered over
  a Socket.IO gateway and by email, with a per-user preference matrix
  ([see below](#real-time-notifications)).
- **Two React frontends** — a user app and an admin panel, sharing wire
  contracts from `packages/shared`.
- **Modular by subtraction** — every optional module above ships a generated
  removal recipe, and CI proves the API still builds without it
  ([see below](#modular-by-subtraction)).

## Stack

NestJS 11 on **Fastify** (ESM-only, SWC) · Prisma 7 + PostgreSQL · Redis
(single & cluster) · Socket.IO 4 with the Redis adapter · AWS SDK v3 (S3, SQS,
SNS, SES, Lambda — all runnable offline via LocalStack + MinIO) · pnpm
workspaces + Turborepo · Biome · Vitest + supertest.

## Prerequisites

- **Node 24** (`.nvmrc` provided — `nvm use` picks it up)
- **pnpm 11** via corepack: `corepack enable && corepack install`
- **Docker** with the compose plugin

## Local development

```bash
git clone git@github.com:ivpoov/nest-aws-starter.git
cd nest-aws-starter
nvm use                       # Node 24
corepack enable               # activates the pinned pnpm
pnpm install

# environment
cp apps/api/.env.example apps/api/.env   # works as-is against the compose stack

# infrastructure: Postgres, Redis, LocalStack (SQS/SNS/SES/Lambda), MinIO
docker compose up -d --wait

# database
pnpm --dir apps/api run db:migrate       # apply committed migrations

# run the API in watch mode
pnpm --dir apps/api run start:dev
```

The API listens on `http://localhost:3000` — Swagger UI at
[`/docs`](http://localhost:3000/docs), health probes at
`/api/v1/health/live` and `/api/v1/health/ready`.

### Frontends

```bash
pnpm --dir apps/web run dev      # user app on http://localhost:5173
pnpm --dir apps/admin run dev    # admin panel on http://localhost:5174
```

Both apps read `VITE_API_BASE_URL` (see each app's `.env.example`; the default
targets the local API). The admin panel requires an `ADMIN` account — promote a
user directly in the database, there is deliberately no promote endpoint.

### Host ports

Container ports are shifted off the standard ones so the stack coexists with
locally running services, and are overridable via a root `.env`
(see `.env.example`):

| Service | Host port |
|---|---|
| PostgreSQL | 5433 |
| Redis | 6390 |
| LocalStack | 4567 |
| MinIO (API / console) | 9010 / 9011 |

### Optional compose profiles

```bash
docker compose --profile init up minio-init    # create the S3 bucket once
docker compose --profile cluster up -d         # 4-node Redis cluster on 7000-7003
```

## Real-time notifications

Domain events — a new-device login, a password change, a subscription
activated or ended, a failed payment, a new contact message, a failed
webhook — are turned into notifications by a dispatcher. Each notification is
**persisted first**, then fanned out: live to connected clients over a
Socket.IO gateway, and by email where the user has that channel enabled. A
delivery failure never rolls back the stored row, so the bell and the history
page stay correct even if a channel is down.

Notifications are addressed to one of two audiences: `USER` (the recipient's
own feed) or `ADMIN` (every admin, e.g. `WEBHOOK_FAILED`, `CONTACT_MESSAGE`).

### The socket

The API mounts a Socket.IO gateway on the same HTTP server as the REST API, at
the default `/socket.io` path — at the **root**, outside the `/api/v1` prefix.
Both frontends derive the socket URL from `VITE_API_BASE_URL`'s origin
(`src/utils/getSocketBaseUrl.ts`) instead of taking a second env var, so an API
base of `http://localhost:3000/api/v1` implies a socket at
`http://localhost:3000`. That derivation is the supported topology out of the
box; a deployment that serves the REST prefix and the WebSocket upgrade from
*different* origins needs its own socket URL instead.

### Authenticating a client

This project uses **no cookies anywhere**. A socket client presents the very
same access token it would send in an HTTP `Authorization: Bearer` header, in
the Socket.IO handshake's `auth.token`:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: (cb) => cb({ token: accessToken }),
});
```

Prefer that **callback** form over a static `auth: { token }` object — Socket.IO
re-evaluates it on every reconnect, so a token refreshed in the meantime is
picked up automatically.

The handshake token is validated exactly like an HTTP request: JWT signature
plus the Redis allowlist lookup. A socket with a missing, invalid or revoked
token is disconnected rather than sent an error event. Connected sockets are
also re-validated by a background sweep every
`WEBSOCKET_HEARTBEAT_INTERVAL_MS` (default `60000`), so revoking a session
severs live sockets too — not just future HTTP calls.

### Rooms and events

Every authenticated socket joins `user:<userId>`; admins additionally join
`admins`. The server emits two events, and accepts none from the client:

| Event | Payload | Sent to |
|---|---|---|
| `notification` | the new notification | the recipient's user room, or `admins` for admin-audience rows |
| `unread-count` | a number | the recipient's user room |

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `WEBSOCKET_ENABLED` | `true` | Toggles the live socket transport. Persistence, the REST endpoints below and the email channel are unaffected — only live delivery stops. |
| `WEBSOCKET_HEARTBEAT_INTERVAL_MS` | `60000` | How often connected sockets are re-validated. |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Comma-separated browser origins allowed by **both** HTTP CORS and the socket handshake. Add your deployed frontend origins here or the socket will not connect. |

**Redis is what makes this multi-instance safe.** The gateway runs behind
`@socket.io/redis-adapter`, so a notification created on API instance A still
reaches a socket held by instance B. Redis is already required for the API to
boot at all (token allowlist, throttler storage, OAuth state), so this adds no
new infrastructure — but without the adapter a horizontally scaled deployment
would deliver to only the instance that happened to handle the event.

### Preferences and the email channel

Users get a per-type, per-channel preference matrix:

- **`IN_APP`** is always on and not editable — it is what the bell reads.
- **`EMAIL`** is opt-out per notification type, and passes three gates: the
  global `MAIL_ENABLED` provider flag, the user's preference for that type,
  and the user having an email address on file (OAuth-only accounts may not).
  Any gate off means no mail is sent and no error is raised.

```
GET    /api/v1/notifications                 # cursor-paginated feed
GET    /api/v1/notifications/unread-count
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all
GET    /api/v1/notifications/preferences     # the matrix
PUT    /api/v1/notifications/preferences
```

In the frontends this is the bell in both layouts, plus
`/settings/notifications` in the user app and `/notifications` (full history,
filterable) in the admin panel.

## Testing

```bash
pnpm run test        # unit tests (no infrastructure needed)
pnpm run test:e2e    # e2e against the compose stack (start it first)
pnpm exec biome ci . # lint + format check
```

Every module ships unit + e2e tests; CI (GitHub Actions) runs lint, build,
both test suites and a dependency audit on every PR.

`test:e2e` runs a one-time preflight before any spec that checks LocalStack
is reachable and that the SQS queues / SNS topic the init script provisions
actually exist. If you see `E2E PREFLIGHT: LocalStack is up but missing:
...`, LocalStack was started before `docker/localstack/init-aws.sh` ran
against it (a stale container — this happens after a `docker compose up -d`
that reuses an existing container instead of recreating it). Fix:

```bash
docker compose up -d --force-recreate localstack
```

## Modular by subtraction

This is a starter, so the parts you don't want should come out cleanly. Optional
modules leave `// <module:x>` fence markers at their cross-module references,
and `scripts/subtraction-test.mjs` uses them two ways: it generates the
per-module removal recipes in [`docs/removal/`](./docs/removal), and it proves
them by deleting each module in an isolated worktree and rebuilding what's left.
CI runs both nightly and on pushes to release branches, failing if a recipe has
drifted from the code.

```bash
node scripts/subtraction-test.mjs                   # prove every module
node scripts/subtraction-test.mjs --module payment  # just one
```

To drop a module, follow its recipe — e.g.
[`docs/removal/notification.md`](./docs/removal/notification.md).

One honest caveat, spelled out per module in
[`docs/removal/README.md`](./docs/removal/README.md): the fence markers cover
`apps/api` completely, but the frontend and `packages/shared` halves of the
bigger modules are still documented as by-hand steps rather than fenced. Those
recipes list every file involved, and the script deletes what it safely can, but
it can only *prove* the API half — so run each recipe's own verify block after
following it.

## Repository layout

```
apps/api/         # NestJS API — controller → service → repository layering
apps/web/         # user app — Vite + React + Tailwind + Zustand
apps/admin/       # admin panel — same stack, role-gated
packages/shared/  # wire contracts shared by API and frontends
lambdas/example/  # echo Lambda demonstrating the invoker pattern
docker/           # compose init scripts
docs/conventions/ # binding code conventions — read before contributing
docs/removal/     # generated per-module removal recipes
scripts/          # subtraction test + removal-recipe generator
```

**Read `docs/conventions/backend.md` before writing any backend code** — it is
the law of this repository, and the `note` module is its living reference
implementation.
