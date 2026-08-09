# Containerizing the API

`apps/api/Dockerfile` produces the image ECS Fargate runs. It is a three-stage
build — `deps`, `build`, `runtime` — on `node:24.18.0-alpine3.24`, pinned by
digest.

Every command below has been run against this repository. If one stops working,
that is a bug in this document.

## TL;DR

```bash
docker compose up -d --wait

DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10" \
  pnpm --dir apps/api run db:migrate

DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10" \
  docker build \
    --network=host \
    --provenance=false \
    -f apps/api/Dockerfile \
    -t nest-aws-starter-api:dev \
    --secret id=database_url,env=DATABASE_URL \
    .
```

The rest of this page explains why each of those flags is there. If you want
the image *running* against the compose stack rather than just built, skip to
[the `full` compose profile](#the-full-compose-profile) — it wraps all of it.

## Building

### The context is the repository root

```bash
docker build -f apps/api/Dockerfile .   # note the trailing dot
```

This is a pnpm workspace. `apps/api` alone is not buildable: the lockfile, the
root manifest, `pnpm-workspace.yaml` and `packages/shared` all live above it.
The root `.dockerignore` keeps the context small — no `node_modules`, no
`dist`, no `.git`, no `.env`.

### The build needs a live, migrated Postgres

This is the one genuinely surprising requirement, and it is not the
Dockerfile's doing. The API's build script starts with `prisma generate --sql`,
and Prisma's TypedSQL type-checks every file in `apps/api/prisma/sql` against a
real database — a reachable port is not enough, the tables have to exist. CI
runs `db:migrate` before `pnpm run build` for exactly the same reason.

So: bring the compose stack up, migrate it, and let the build reach it.

```bash
docker compose up -d --wait

DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10" \
  pnpm --dir apps/api run db:migrate
```

The URL is handed to the build as a **BuildKit secret**, not a build arg. A
build arg is recorded in image history, where anyone who can pull the image can
read it; a secret is mounted for the lifetime of one `RUN` and never written to
a layer.

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10" \
  docker build \
    --network=host \
    -f apps/api/Dockerfile \
    -t nest-aws-starter-api:dev \
    --secret id=database_url,env=DATABASE_URL \
    .
```

`--network=host` is what lets the build container reach the compose Postgres
published on `localhost:5433`. Without it the build fails with `P1001 Can't
reach database server`. Any migrated, throwaway Postgres will do — it is read
for type information only, and nothing from it ends up in the image.

### Not `nest build`

There is no `nest build` step, because `@nestjs/cli` is deliberately not a
dependency of this repository. `pnpm --filter "@nest-aws-starter/api" run build`
is `prisma generate --sql`, then `tsc --noEmit` as a type gate, then **SWC** for
the actual emit. The Dockerfile runs that script; it does not reimplement it.

## Layer caching: why the stages are split where they are

Three stages, each cut at a boundary where the inputs change at a different
rate. A layer's cache key is the content of what was `COPY`'d into it, so the
whole design is about copying as little as possible, as late as possible.

| Stage     | Copies                       | Re-runs when                    |
| --------- | ---------------------------- | ------------------------------- |
| `base`    | `package.json`               | the pinned pnpm version changes |
| `deps`    | `pnpm-lock.yaml`             | a dependency changes            |
| `build`   | manifests, then sources      | manifests, then any source file |
| `runtime` | build output only            | the build output changes        |

**`base`** copies only the root manifest and runs `corepack install`, which
reads the `packageManager` field. The pnpm version in the image is therefore the
version the repository pins, with no second place to keep in step.

**`deps`** copies **only `pnpm-lock.yaml`** and runs `pnpm fetch`. `pnpm fetch`
is built for this: it populates the pnpm store straight from a lockfile,
ignoring package manifests entirely. Because nothing else is in the layer,
editing a service, adding a controller, or adding a whole new workspace package
cannot invalidate it — the download only repeats when a dependency actually
changes. It fetches dev dependencies too, since the build stage needs SWC,
TypeScript and the Prisma CLI; none of that reaches the runtime image.

**`build`** copies every workspace `package.json` *before* any source, then runs
`pnpm install --frozen-lockfile --offline`. Installs only read manifests, so
splitting the copy means a source edit re-runs the compile but not the install.
`--offline` is a deliberate assertion: if the `deps` stage missed anything, the
install fails here rather than quietly reaching the network and making the cache
a lie. All five manifests are copied even though only the API is built, because
`--frozen-lockfile` validates the lockfile against the entire workspace.

**`runtime`** starts from the base image again and copies nothing but the build
output. None of the toolchain, none of the pnpm store, none of the sources.

## What ends up in the image, and what does not

`pnpm deploy` rewrites the workspace symlink graph into a directory that stands
on its own — `packages/shared` included — which is what makes it copyable into
a stage that has no workspace at all.

```
pnpm --filter "@nest-aws-starter/api" deploy --legacy --prod --no-optional /deploy
```

Three flags, three reasons:

- **`--legacy`** — from pnpm 10 the modern implementation refuses to run unless
  the workspace sets `inject-workspace-packages=true`. Turning that on changes
  how every developer's install is linked and rewrites the lockfile: far too
  much blast radius for a packaging concern. The legacy implementation produces
  exactly the self-contained tree we want, so it is the deliberate choice.
- **`--prod`** — drops devDependencies.
- **`--no-optional`** — `@prisma/client` declares the `prisma` CLI as an
  *optional peer*, and the workspace has that CLI as a devDependency, so a plain
  `--prod` deploy drags the whole thing in: Prisma Studio, a bundled React
  build, pglite, the schema engines. That is **484 MB** of `node_modules`
  instead of **234 MB**. Nothing dropped is loaded at runtime, and the readiness
  probe below exercises the Prisma path end to end to prove it.

Two prunes follow:

1. **Query compilers.** Prisma 7 with a driver adapter executes queries through
   a WASM query compiler bundled inside `@prisma/client`, one per database
   engine. This app is PostgreSQL-only, so the CockroachDB, MySQL, SQLite and
   SQL Server compilers are 60 MB of dead weight. The delete is followed by a
   `test` that the PostgreSQL compiler survived — if a Prisma upgrade renames
   these files, the build fails loudly instead of shipping an image that dies on
   its first query.
2. **Non-executable files.** `*.ts`, `*.map` and `*.md` under `node_modules`,
   plus the compiled `*.spec.js` in `dist`. Nothing a running Node process
   loads, and worth ~90 MB. `LICENSE` files are deliberately kept: shipping a
   binary without the licence texts of what it embeds is not a size
   optimisation. The application's own source maps in `dist/` are kept too, so
   its stack traces stay readable.

The runtime stage then runs as the unprivileged `node` user that the
`node:alpine` images already ship, with `NODE_ENV=production` baked in.

### Measured size

```bash
docker history nest-aws-starter-api:dev --format '{{.Size}}'
```

```
0B 0B 0B 0B 4.1kB 7.48MB 88.2MB 0B 0B 0B 0B 4.1kB 5.43MB 0B 157MB 0B 0B 10MB
```

**268 MB** uncompressed, of which 172 MB is the Node 24 Alpine base image
itself and 88 MB is production `node_modules`. Compressed — what a Fargate task
actually pulls — it is **73 MB**:

```bash
docker save nest-aws-starter-api:dev | wc -c   # 73318400
```

## Running it

`NODE_ENV=production` is baked into the image, which arms the production boot
guard: the app refuses to start while any development default from
`apps/api/.env.example` is still in place, and refuses a JWT secret carrying
under 256 bits of measurable entropy. That is the point — a container handed
laptop configuration should not start. Give it real values.

### The `full` compose profile

`docker-compose.yml` carries a `full` profile that does all of this for you:
it builds the image with the right flags and runs it against the same
Postgres, Redis, LocalStack and MinIO the dev stack already uses. "Works on my
machine" and "works in the container" stop being two separate claims, because
both are the same stack.

```bash
docker compose up -d --wait

export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/starter?connection_limit=10"
pnpm --dir apps/api run db:migrate

export API_JWT_SECRET="$(openssl rand -hex 48)"
docker compose --profile full up -d --build
```

```bash
curl -s http://localhost:3080/api/v1/health/ready
```

```json
{ "status": "ok", "database": true, "redis": true }
```

Four things are worth knowing about that profile.

**`DATABASE_URL` is for the build, not the container.** It is exposed to the
build as a BuildKit secret (`build.secrets`), and the build runs with
`network: host` so it can reach the compose Postgres on its *published* port.
The running container gets a different URL entirely — `postgres:5432`, the
service name on the compose network. That is also why `db:migrate` has to come
first: TypedSQL needs the tables, not just the port.

**`API_JWT_SECRET` has no default, deliberately.** A committed value strong
enough to pass the 256-bit entropy check would be a development default in
everything but name, and the guard could not tell it from a real secret. So
the profile ships without one, and the container refuses to boot until you
export one:

```
ERROR [ProductionGuardConfig] Refusing to boot with NODE_ENV=production:
  - [PRODUCTION_WEAK_JWT_SECRET] AUTH_JWT_SECRET is 0 characters carrying at
    most ~0 bits of entropy, below the 256 bits (32 bytes) required — ...
```

That refusal is the profile doing its job. Every *other* value in it is already
chosen to clear the guard: deployed-looking CORS and web origins, LocalStack
credentials that are not the literal `test`, and a MinIO credential of the
API's own rather than the public `minioadmin` default — `minio-init`
provisions the `starter-api` user, which is why `api` waits for it to complete.

**The image does not run migrations.** The `prisma` CLI is deliberately not in
it, so the `db:migrate` above is doing double duty: it prepares the database
for the build *and* for the container that follows.

**Port 3080, not 3000**, so the containerized API and a `pnpm start:dev` on the
host can run side by side and be compared. Override with `API_PORT`.

Tear down just the API and leave the services running:

```bash
docker compose --profile full stop api
```

### By hand

The profile is only wrapping a `docker run`. The long form, joining the compose
network so the container can use the service names:

```bash
docker run -d --name api-smoke --network nest-aws-starter_default -p 3080:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@postgres:5432/starter?connection_limit=10" \
  -e REDIS_URL="redis://redis:6379" \
  -e AUTH_JWT_SECRET="$(openssl rand -hex 48)" \
  -e CORS_ORIGINS="https://app.example.com" \
  -e WEB_APP_BASE_URL="https://app.example.com" \
  -e TRUST_PROXY=true \
  -e AWS_REGION=us-east-1 \
  -e AWS_ENDPOINT_URL="http://localstack:4566" \
  -e AWS_ACCESS_KEY_ID="AKIAIOSFODNN7SMOKE" \
  -e AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMISmokeTestOnlyNotARealKey" \
  -e S3_ENABLED=true -e S3_ENDPOINT="http://minio:9000" -e S3_BUCKET_NAME=starter \
  -e S3_ACCESS_KEY="smoke-access-key" -e S3_SECRET_KEY="smoke-secret-key" \
  -e SQS_ENABLED=true -e SNS_ENABLED=true -e LAMBDA_ENABLED=true \
  -e SQS_PAYMENT_WEBHOOK_QUEUE_URL="http://localstack:4566/000000000000/starter-payment-webhook-queue" \
  -e PAYMENT_WEBHOOK_CONSUMER_ENABLED=false -e SCHEDULER_ENABLED=false \
  -e MAIL_ENABLED=true -e MAIL_FROM_ADDRESS="no-reply@api.example.com" \
  -e WEBSOCKET_ENABLED=true \
  nest-aws-starter-api:dev
```

Note the ports: inside the compose network Postgres and Redis are on their
native `5432`/`6379`, not the shifted host ports from `.env.example`.

Readiness — Postgres and Redis, checked for real:

```bash
curl -s http://localhost:3080/api/v1/health/ready
```

```json
{ "status": "ok", "database": true, "redis": true }
```

That `database: true` is a live `SELECT 1` through Prisma, which is the proof
that the pruned `node_modules` still carries a working query path.

### The `HEALTHCHECK`

The image's own `HEALTHCHECK` polls **liveness**, not readiness:

```bash
docker inspect --format '{{.State.Health.Status}}' api-smoke   # healthy
```

Liveness answers "is this process still serving?". Whether Postgres and Redis
are reachable is `/health/ready`'s question and the load balancer's business —
a database blip should not make Docker or ECS kill an otherwise healthy
container. The probe is a `node -e` one-liner using the global `fetch`, so the
image needs neither `curl` nor `wget`. It builds its URL from `API_PREFIX`,
because the app mounts every route under that prefix with URI versioning on top:
`/api/v1/health/live`.

### Shutdown

`CMD` is in exec form, so `node` is PID 1 and receives `SIGTERM` directly. NestJS
`enableShutdownHooks()` then drains in-flight requests and closes Redis, Prisma
and the Socket.IO adapter. This is what makes an ECS rolling deploy safe: a
container that ignored `SIGTERM` would be `SIGKILL`ed mid-request once the
`stopTimeout` expired.

Measured by timestamping the signal and comparing against the daemon's recorded
`FinishedAt`:

```bash
date -u +%Y-%m-%dT%H:%M:%S.%NZ              # 2026-08-09T06:16:24.800374083Z
docker kill -s TERM api-smoke
docker inspect --format '{{.State.ExitCode}}' api-smoke     # 0
docker inspect --format '{{.State.FinishedAt}}' api-smoke   # ...T06:16:24.897075635Z
```

Exit code **0** — a clean shutdown, not the 137 of a `SIGKILL` — reached in
**97 ms**, and that figure still includes the `docker kill` round trip. The
default `docker stop` window is 10 s and a typical ECS `stopTimeout` is 30 s.

Tear down:

```bash
docker rm -f api-smoke
```

## CI

`.github/workflows/image.yml` builds this image on every pull request that
touches `apps/api/**`, `packages/shared/**`, the lockfile or workspace
manifests, `.dockerignore`, or `docker-compose.yml`. Build only — nothing is
pushed, so no registry credential is ever in scope and the job is safe on
pull requests from forks.

It exists because a Dockerfile rots quietly. Nothing in `ci.yml` compiles the
image, so a new workspace package, a dependency that needs a build toolchain,
or a `pnpm deploy` flag that changes behaviour would all go green on every PR
and surface for the first time on the day someone tries to deploy.

The job is the local flow, in order:

```yaml
- run: docker compose up -d --wait postgres
- run: pnpm install --frozen-lockfile --filter "@nest-aws-starter/api..."
- run: pnpm --dir apps/api run db:migrate
- run: docker compose --profile full build api
```

Postgres comes from this repository's own compose file rather than a GitHub
`services:` block, so the version and the port have one definition instead of
two that can drift. Only `postgres` is named — Redis, LocalStack and MinIO
play no part in a build. The install is filtered to the API and its workspace
dependencies, because the Vite and React toolchains are hundreds of megabytes
this job never touches; the Prisma CLI is what it is actually after.

The build step is `docker compose --profile full build api` rather than a
hand-written `docker build`, so `--network=host` and the `database_url` secret
live in exactly one place — the `full` profile — instead of in a second copy
that would be the first thing to go stale. It also means every PR exercises
that profile's build wiring, not just the Dockerfile.

## Notes for deployment

- **Migrations are not run by this image.** The `prisma` CLI is deliberately not
  in it. `prisma migrate deploy` belongs in a separate task that runs before the
  rolling update, which is Stage D's business.
- **Set `initProcessEnabled`** on the ECS task definition (or `docker run
  --init`). Node as PID 1 handles its own signals correctly but does not reap
  orphaned zombies.
- **`stopTimeout`** must be at least as long as the app's drain time. The 97 ms
  measured above is an idle container; size the window for the slowest request
  you are willing to wait for.
- **Upgrading the base image** means replacing the digest *and* its comment
  together in `apps/api/Dockerfile`. A comment that disagrees with its digest is
  worse than no comment, because review stops reading the digest.
