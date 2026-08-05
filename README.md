# nest-aws-starter

AWS-native, production-grade NestJS + React full-stack starter.

> **WIP — v0.1 "Foundation".** The API core is complete; auth, frontends and
> payments arrive in later releases. Full documentation is a v1.0 task.

## Stack

NestJS 11 on **Fastify** (ESM-only, SWC) · Prisma 7 + PostgreSQL · Redis
(single & cluster) · AWS SDK v3 (S3, SQS, SNS, SES, Lambda — all runnable
offline via LocalStack + MinIO) · pnpm workspaces + Turborepo · Biome ·
Vitest + supertest.

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

## Repository layout

```
apps/api/         # NestJS API — controller → service → repository layering
apps/web/         # user app — Vite + React + Tailwind + Zustand
apps/admin/       # admin panel — same stack, role-gated
packages/shared/  # wire contracts shared by API and frontends
lambdas/example/  # echo Lambda demonstrating the invoker pattern
docker/           # compose init scripts
docs/conventions/ # binding code conventions — read before contributing
```

**Read `docs/conventions/backend.md` before writing any backend code** — it is
the law of this repository, and the `note` module is its living reference
implementation.
