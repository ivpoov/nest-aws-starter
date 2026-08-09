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

## Make it yours

A starter you cloned still carries the original name in about 550 places —
every `package.json`, every `@nest-aws-starter/shared` import, the compose
project, the database, the MinIO bucket, the SQS queues, the SNS topic, the
Swagger title, the Terraform `project_name`, the image tag, the `CODEOWNERS`
handle. Renaming that by hand is an afternoon of grep. One command instead:

```bash
pnpm bootstrap --name my-app --scope @my-app --author "Jane Doe"
```

It rewrites every file git tracks, regenerates `pnpm-lock.yaml`, and re-runs
`biome check --write` — a shorter scope changes line widths and import order,
so a renamed clone that skipped the format pass fails `pnpm run lint`. Add
`--dry-run` first if you want to see the list before anything is written.

| flag | what it does |
| --- | --- |
| `--name` | project name. Required, lowercase kebab-case. |
| `--scope` | workspace scope for `packages/shared` and friends. Defaults to `@<name>`. |
| `--author` | `LICENSE` copyright holder, plus `author` in the root `package.json`. |
| `--repo` | `owner/repo` for the absolute GitHub URLs (see below). Defaults to this clone's `origin`. |
| `--db` | Postgres database name. Defaults to `<name>` with dashes as underscores — Terraform's `database_name` rejects dashes. |
| `--drop-demo` | also delete the `note` demo module — and this script. |
| `--dry-run` | report, write nothing. |

`--drop-demo` does not reimplement the deletion: it calls straight into
`scripts/subtraction-test.mjs`, deleting the `note` module's paths and
stripping its `// <module:note>` fences with the same code CI proves nightly
([see below](#modular-by-subtraction)). It then regenerates `docs/removal/` and
removes itself, because a rename script has one job and you have now done it.

**About `--repo`.** GitHub issue forms do not resolve relative links, so
`SECURITY.md` and `.github/ISSUE_TEMPLATE/` carry absolute `github.com` URLs.
Left alone, a fork's "report a security vulnerability" link points at *this*
repository's inbox rather than yours — silently. `--repo` is what fixes it; if
you omit it the value is read from your clone's `origin` remote, and if that is
still the upstream you get an obvious `your-org/...` placeholder and a warning
rather than a wrong link. Its owner half also becomes the handle in
`.github/CODEOWNERS`, which otherwise demands review from the upstream author
on pull requests they cannot approve.

Two things it deliberately leaves alone: your untracked `.env` files (re-copy
`apps/api/.env.example` afterwards — its `DATABASE_URL` carries the database
name) and any `version` field.

## Local development

```bash
git clone git@github.com:ivpoov/nest-aws-starter.git
cd nest-aws-starter
nvm use                       # Node 24
corepack enable               # activates the pinned pnpm
pnpm install                  # or `pnpm bootstrap ...` first — see above

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

### Running the built image locally (`full` profile)

The `full` profile builds `apps/api/Dockerfile` and runs it against the very
same Postgres, Redis, LocalStack and MinIO — so "works on my machine" and
"works in the container" are one claim, not two. The image runs with
`NODE_ENV=production`, which means the boot guard below is armed, so the
profile supplies deployment-shaped configuration and expects a real secret
from you.

```bash
docker compose up -d --wait

export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10"
pnpm --dir apps/api run db:migrate          # the image build needs migrated tables

export API_JWT_SECRET="$(openssl rand -hex 48)"
docker compose --profile full up -d --build

curl -s http://localhost:3080/api/v1/health/ready
# {"status":"ok","database":true,"redis":true}
```

`.github/workflows/image.yml` runs the same build on every PR that touches the
API, so the Dockerfile cannot rot unnoticed. Full walkthrough — why the build
needs a live database, what the profile does and does not set, how the image
is layered — in [`docs/guides/container.md`](docs/guides/container.md).

## Going to production

Every value in `apps/api/.env.example` works out of the box on a laptop, and
several of them would be a breach on a server. With `NODE_ENV=production` the
API therefore refuses to start — at boot, before it listens, not on first use —
while any of the following holds:

| Refusal | What trips it |
|---|---|
| `PRODUCTION_DEVELOPMENT_DEFAULT` | A credential, endpoint or redirect target still equals the value shipped in `.env.example`: `AUTH_JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, the `AWS_*` and `S3_*` keys and endpoints, `WEB_APP_BASE_URL`, `MAIL_FROM_ADDRESS`, and the payment module's queue and return URLs. |
| `PRODUCTION_WEAK_JWT_SECRET` | `AUTH_JWT_SECRET` carries under 32 bytes (256 bits) of entropy. Length is not entropy — 64 repeated characters score zero. Generate one with `openssl rand -hex 48`. |
| `PRODUCTION_UNSAFE_CORS_ORIGIN` | `CORS_ORIGINS` is unset, contains `*`, or lists a loopback address. |
| `PRODUCTION_UNAUTHENTICATED_SWAGGER` | `SWAGGER_ENABLED=true` without `SWAGGER_USER` and `SWAGGER_PASSWORD`. |

Every violation is reported in the same startup failure, each naming the
variable and the fix, so a misconfigured deploy costs one round trip rather
than one per mistake. Nothing changes outside production: the shipped defaults
still boot for local development, tests and CI.

**On the entropy check.** Entropy belongs to the process that generated a
secret, not to the string, so no static check can measure it — what the guard
computes is an upper bound from the secret's own composition: the shortest
block whose repetition rebuilds it, times the bits per character its alphabet
allows, dropped to the observed Shannon rate when the character distribution is
lopsided. `openssl rand -hex 32` scores exactly 256 and passes; `openssl rand
-hex 48` scores 384. A 44-character `openssl rand -base64 32` is a genuine
32-byte secret but cannot *demonstrate* 256 bits in 44 characters, so it is
turned away — the guard prints a generator that always passes rather than
lowering the bar.

### Response security headers

`@fastify/helmet` runs for every route, configured in
`src/modules/common/helpers/register-security-headers.helper.ts`. The values
are tuned for a JSON API rather than for a rendered page:

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'` | A JSON API loads nothing, so the honest policy is the empty one. Its real job is to make any route that unexpectedly returns HTML inert rather than scriptable. `frame-ancestors` is listed explicitly because it does **not** fall back to `default-src`. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` — **production only** | Sending it from a dev server on `http://localhost` pins the whole localhost origin to https in your browser, for every other project too, long after the process is gone. |
| `X-Content-Type-Options` | `nosniff` | |
| `X-Frame-Options` | `DENY` | The legacy pair of `frame-ancestors 'none'`; helmet's default is `SAMEORIGIN`, which this project has no use for. |
| `Referrer-Policy` | `no-referrer` | A `Referer` carrying a path and an id has no legitimate reader on an API. |
| `Cross-Origin-Resource-Policy` | `same-origin` (helmet default, kept) | Safe here because nothing this API returns is ever loaded as a no-cors subresource: downloads are presigned S3/CloudFront URLs, and the SPAs reach the API only through CORS-mode fetches, which CORP does not gate. |

**Swagger is the exception, by construction.** `/docs` is the one route that is
a real HTML document, and `default-src 'none'` would leave it blank. It is
served under its own policy (`default-src 'self'`, scripts and styles from
`'self'`, `'unsafe-inline'` for styles only, `frame-ancestors 'none'`), applied
in `setup-swagger.helper.ts` and mounted only where the docs themselves are
mounted — off in production unless `SWAGGER_ENABLED=true`, which the boot guard
refuses without basic-auth credentials. If you add `customJs` or an inline
script through `SwaggerCustomOptions`, widen `script-src` there deliberately.

### CORS: an allowlist, and no credentials — on purpose

`CORS_ORIGINS` is an exact-match allowlist (no wildcards, no regex), and
`credentials` is **false**. That second one is a design consequence, not an
oversight, and it should not be "fixed":

- This API is bearer-only. The access token travels in the `Authorization`
  header, the refresh token in a request body, and the socket token in the
  Socket.IO handshake payload. Nothing in the tree sets a cookie, reads a
  cookie, or uses any other ambient credential.
- `Access-Control-Allow-Credentials: true` is what tells a browser it may
  attach ambient credentials to a cross-origin call and hand the response back
  to the calling page. With none to attach it buys nothing, while permanently
  coupling the allowlist to a CSRF exposure: any change that widens
  `CORS_ORIGINS` turns from "an attacker's page can make unauthenticated calls"
  into "an attacker's page can make calls as the logged-in user".

If a browser request starts failing with a CORS error, the fix is `CORS_ORIGINS`
or the allowed-header list — never this flag. Enabling it is only correct
alongside a deliberate move to cookie-based auth, which brings its own CSRF
defences (`SameSite`, an anti-forgery token) that this starter does not ship.

### Client ip and `TRUST_PROXY`

`X-Forwarded-For` is attacker-controlled unless something trustworthy sets it.
`TRUST_PROXY` is therefore honoured in exactly two places and nowhere else: the
Fastify adapter (which is what makes `request.ip` derive from the header) and
`ThrottlerBehindProxyGuard`. With `TRUST_PROXY=false` the header is ignored
outright, so a client cannot mint itself fresh rate-limit budgets — or a clean
suspicious-login history — by inventing one. Set it to `true` only when every
request genuinely arrives through a proxy you control (ALB, CloudFront) that
overwrites the header; if clients can reach the API directly, leave it off.

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
| `WEBSOCKET_ENABLED` | `true` | Toggles the live socket transport. `false` installs **no** socket transport at all: no `/socket.io` endpoint exists, handshakes get a hard connection error rather than an accept-then-drop loop, and the adapter's two Redis pub/sub connections are never opened. Persistence, the REST endpoints below and the email channel are unaffected — only live delivery stops. |
| `WEBSOCKET_HEARTBEAT_INTERVAL_MS` | `60000` | How often connected sockets are re-validated. |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Comma-separated browser origins allowed by **both** HTTP CORS and the socket handshake. Add your deployed frontend origins here or the socket will not connect. |

**Redis is what makes this multi-instance safe.** With `WEBSOCKET_ENABLED=true`
the gateway runs behind `@socket.io/redis-adapter`, so a notification created on API instance A still
reaches a socket held by instance B. Redis is already required for the API to
boot at all (token allowlist, throttler storage, OAuth state), so this adds no
new infrastructure — but without the adapter a horizontally scaled deployment
would deliver to only the instance that happened to handle the event.

### Preferences and the email channel

Users get a per-type, per-channel preference matrix:

- **`IN_APP`** is always on and not editable — it is what the bell reads.
- **`EMAIL`** is opt-out per notification type, and passes four gates: the
  global `MAIL_ENABLED` provider flag, the user's preference for that type,
  the user having an email address on file (OAuth-only accounts may not), and
  the throttle below. Any gate off means no mail is sent and no error is
  raised.

#### The email throttle

The EMAIL channel is rate-limited to **at most one email per user, per
notification type, per hour**. A webhook or login storm still persists every
row and still pushes every socket event — the throttle gates the email channel
only, never persistence and never live delivery.

It is Redis-backed: a single `SET <key> NX EX 3600` both claims the slot and
starts the window, so concurrent dispatches on different API instances cannot
both win, and later attempts inside the window never push the TTL out. The
claim is the *last* gate before the transport, so a recipient with no email
address on file never burns their window.

**It fails open.** If Redis is unreachable the claim is treated as granted and
a warning is logged — the same availability-over-strictness rule the login
lockout follows. The worst case during a Redis outage is duplicate mail, never
lost mail.

```
GET    /api/v1/notifications                 # cursor-paginated feed
GET    /api/v1/notifications/unread-count
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all
GET    /api/v1/notifications/preferences     # the matrix
PUT    /api/v1/notifications/preferences
```

The feed takes all-optional query params, and they compose with each other and
with the cursor: `cursor` (the last id of the previous page), `limit`
(`1`–`100`, default `20`), `unreadOnly` (only the literal string `true` is
true), `type` (a `NotificationTypeEnum` member) and `audience` (`USER` |
`ADMIN`). Anything outside those ranges is a `400`. `audience` only ever
narrows: a non-admin asking for `ADMIN` gets an empty page, not a `403`.
`nextCursor` is non-null only on a full page, and it describes the *filtered*
result set — so a filter never leaves a "Load more" button pointing at rows the
user is not looking at.

In the frontends this is the bell in both layouts, plus
`/settings/notifications` in the user app and `/notifications` (full history,
filterable by type, audience and read state — all server-side) in the admin
panel.

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

## Containers

`apps/api/Dockerfile` builds the production API image — a multi-stage,
pnpm-aware build on a digest-pinned Node 24 Alpine base, 268 MB uncompressed and
73 MB compressed, running as a non-root user with a `HEALTHCHECK` against
`/health/live`. It expects the repository root as its build context, and it
needs a migrated Postgres to reach, because `prisma generate --sql` type-checks
the TypedSQL queries against a live database.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10" \
  docker build --network=host -f apps/api/Dockerfile -t nest-aws-starter-api:dev \
    --secret id=database_url,env=DATABASE_URL .
```

[`docs/guides/container.md`](./docs/guides/container.md) covers the layer-cache
design, what is pruned out of the image and why, and how to run it against the
compose stack.

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
[`docs/removal/notification.md`](./docs/removal/notification.md). The `note`
demo module has a recipe too, which is what `pnpm bootstrap --drop-demo` runs
for you.

One honest caveat, spelled out per module in
[`docs/removal/README.md`](./docs/removal/README.md): every module is fenced
across `apps/api` (`src` *and* `test`), both frontends and `packages/shared`, so
each removal is type-checked and unit-tested end to end — but the e2e suite is
only ever type-checked, never executed. It needs a live
Postgres/Redis/LocalStack, and a throwaway worktree has none. Run each recipe's
own `test:e2e` line yourself after following it.

## Repository layout

```
apps/api/         # NestJS API — controller → service → repository layering
apps/web/         # user app — Vite + React + Tailwind + Zustand
apps/admin/       # admin panel — same stack, role-gated
packages/shared/  # wire contracts shared by API and frontends
lambdas/example/  # echo Lambda demonstrating the invoker pattern
docker/           # compose init scripts
docs/architecture.md # request lifecycle, event map, caching tiers, AWS surface
docs/conventions/ # binding code conventions — read before contributing
docs/decisions/   # architecture decision records — why, and what it cost
docs/guides/      # operational guides — building and running the API image
docs/removal/     # generated per-module removal recipes
scripts/          # bootstrap rename + subtraction test + removal-recipe generator
```

Start with [`docs/architecture.md`](./docs/architecture.md) for how the pieces
fit together, and [`docs/decisions/`](./docs/decisions) for why they fit that
way.

**Read the conventions before writing code** — they are the law of this
repository, and reviewers apply them literally:

- [`docs/conventions/backend.md`](./docs/conventions/backend.md) — `apps/api`.
  The `note` module is its living reference implementation.
- [`docs/conventions/frontend.md`](./docs/conventions/frontend.md) — `apps/web`
  and `apps/admin`.
- [`docs/conventions/shared-contracts.md`](./docs/conventions/shared-contracts.md)
  — `packages/shared`, the wire contracts all three consume.

How work flows through branches, commits and PRs is a separate concern and lives
in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT — see [`LICENSE`](./LICENSE). Clone it, change it, ship it; keep the
copyright notice. To report a security issue, follow
[`SECURITY.md`](./SECURITY.md).
