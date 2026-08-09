# syntax=docker/dockerfile:1.19
#
# Build context is the REPOSITORY ROOT, not apps/api:
#   docker build -f apps/api/Dockerfile .
# A pnpm workspace build needs the root manifest, the shared lockfile and
# packages/shared — none of which exist below apps/api.
#
# The build also needs a reachable, migrated Postgres, because the API's build
# script runs `prisma generate --sql`, and TypedSQL type-checks every query in
# apps/api/prisma/sql against a live database. That is the same reason CI runs
# `db:migrate` before `pnpm run build`. The URL is passed as a BuildKit secret
# rather than a build arg so it never lands in image history:
#   docker build --secret id=database_url,env=DATABASE_URL ...
# See docs/guides/container.md for the exact commands.

# Pinned by digest, not by tag. A tag is a mutable pointer: `24-alpine` becomes
# a different Node and a different Alpine on the next upstream push, and every
# build that trusts it silently changes. This is the same supply-chain rule the
# CI workflows apply to their actions. To upgrade, take the new digest from the
# registry and update the digest and the comment together.
#
# node:24.18.0-alpine3.24, published 2026-06-24. Node 24 is the active LTS
# line; 24.19.0 and 24.18.1 are deliberately not used yet — the version policy
# is "newest stable that has been out for 30 days", so a bad release is not
# adopted the week it ships.
ARG NODE_IMAGE=node:24.18.0-alpine3.24@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd


# --------------------------------------------------------------------------
# base — Node plus the exact pnpm this repository pins, and nothing else.
# --------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base

# HUSKY=0 stops the root `prepare` script from trying to install git hooks in
# an image that has no .git. CI=1 keeps pnpm's output non-interactive.
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    HUSKY=0 \
    CI=1

WORKDIR /repo

# `corepack install` reads the `packageManager` field, so the pnpm version in
# the image is the one the repository pins — there is no second place to keep
# in step. Only the root manifest is copied here, so this layer survives every
# change that is not a pnpm bump.
COPY package.json ./
RUN corepack enable && corepack install


# --------------------------------------------------------------------------
# deps — download every package in the lockfile into the pnpm store.
#
# Only pnpm-lock.yaml is copied, which is the whole point: this layer's cache
# key is the lockfile and nothing else. Source edits, manifest edits, even a
# new workspace package leave it untouched, so the expensive network step is
# paid once per dependency change instead of once per build.
#
# `pnpm fetch` deliberately fetches dev dependencies too — the build stage
# needs SWC, TypeScript and the Prisma CLI. Nothing from this stage reaches the
# runtime image.
# --------------------------------------------------------------------------
FROM base AS deps

COPY pnpm-lock.yaml ./
RUN pnpm fetch


# --------------------------------------------------------------------------
# build — install from the fetched store, generate the Prisma client, compile,
# then resolve a self-contained production node_modules.
# --------------------------------------------------------------------------
FROM deps AS build

# Manifests first, sources second. `pnpm install` only reads manifests, so
# putting them in their own layer means editing a .ts file re-runs the compile
# but not the install. Every workspace project's manifest has to be here even
# though only the API is built: --frozen-lockfile validates the lockfile
# against the whole workspace, and pnpm-workspace.yaml carries the dependency
# overrides and the build allowlist (argon2, @swc/core) that install honours.
COPY pnpm-workspace.yaml ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY lambdas/example/package.json lambdas/example/
COPY packages/shared/package.json packages/shared/

# --offline proves the deps stage really did fetch everything: if a package is
# missing from the store the install fails here instead of quietly reaching out
# to the registry. The filter installs the API and its workspace dependencies
# only, so the web and admin toolchains are never linked.
RUN pnpm install --frozen-lockfile --offline --filter "@nest-aws-starter/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api

# .dockerignore excludes every .env file from the context; this proves it did.
# The patterns there were once bare (`.env`, `.env.*`), which match the context
# root only — so a developer's apps/api/.env, with DATABASE_URL, AWS keys and
# AUTH_JWT_SECRET in it, was copied into this stage. That is the stage the
# deploy workflow pushes to ECR as the migration image, so a broken pattern has
# to break the build rather than ship a readable secret in a layer. Cheap, runs
# before the expensive compile, and fails loudly with the offending path.
RUN set -eu; \
    for leaked in .env apps/api/.env packages/shared/.env; do \
      if [ -e "$leaked" ]; then \
        echo "SECRET LEAK: $leaked reached the build context — fix .dockerignore" >&2; \
        exit 1; \
      fi; \
    done

# `pnpm run build` for the API is `prisma generate --sql && tsc --noEmit && swc`
# — SWC, not `nest build`: @nestjs/cli is not a dependency of this repository.
# The filter's trailing "..." builds packages/shared first, in dependency order.
RUN --mount=type=secret,id=database_url,required=true \
    DATABASE_URL="$(cat /run/secrets/database_url)" \
    pnpm --filter "@nest-aws-starter/api..." run build

# `pnpm deploy` rewrites the workspace symlink graph into a directory that
# stands on its own — packages/shared included — which is what makes it
# copyable into a stage that has no workspace at all.
#
# --legacy: from pnpm 10 the non-legacy implementation refuses to run unless
#   the workspace sets inject-workspace-packages=true. Turning that on changes
#   how every developer's install is linked and rewrites the lockfile, which is
#   far too much blast radius for a packaging concern, so the legacy
#   implementation is the deliberate choice here.
# --prod: drops devDependencies.
# --no-optional: @prisma/client declares the `prisma` CLI as an *optional* peer
#   and the workspace has it as a devDependency, so a plain --prod deploy drags
#   the whole CLI in — Prisma Studio, a React build, pglite, the schema
#   engines: 484 MB of node_modules instead of 234 MB. Nothing dropped here is
#   loaded at runtime; the readiness probe exercises the Prisma path end to end
#   and proves it.
RUN pnpm --filter "@nest-aws-starter/api" deploy --legacy --prod --no-optional /deploy

# Prisma 7 with a driver adapter executes queries through a WASM query compiler
# shipped inside @prisma/client, one per database engine. This app is
# PostgreSQL-only (@prisma/adapter-pg), so the CockroachDB, MySQL, SQLite and
# SQL Server compilers are 60 MB of dead weight. The final `test` is the guard:
# if a Prisma upgrade ever renames these files, the build fails loudly here
# instead of shipping an image that dies on its first query.
RUN set -eu; \
    find /deploy/node_modules -type f -name 'query_compiler_*' ! -name '*postgresql*' -delete; \
    test -n "$(find /deploy/node_modules -type f -name 'query_compiler_*postgresql*' -print -quit)"

# Nothing here is loaded by a running Node process: TypeScript sources and
# declarations, dependency source maps (the application's own maps in dist/ are
# kept, so its stack traces stay readable) and package documentation. Roughly
# 33 MB. LICENSE files are deliberately left in place — shipping a binary
# without the licence texts of what it embeds is not a size optimisation.
# The compiled test files go too; a runtime image has no business carrying them.
RUN set -eu; \
    find /deploy/node_modules -type f \( -name '*.ts' -o -name '*.map' -o -name '*.md' \) -delete; \
    find /deploy/dist -type f -name '*.spec.js' -delete; \
    find /deploy/dist -type f -name '*.spec.js.map' -delete


# --------------------------------------------------------------------------
# runtime — the only stage that ships.
# --------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# NODE_ENV=production is load-bearing twice over: it switches the app's own
# behaviour (no Swagger, terser logging) and it arms the production boot guard,
# which refuses to start while any development default from .env.example is
# still in place. The container is expected to be handed real configuration.
ENV NODE_ENV=production \
    PORT=3000 \
    API_PREFIX=api

WORKDIR /app

# The node:alpine images already ship an unprivileged `node` user (uid 1000);
# there is nothing to gain from minting another one. Ownership is set during
# the copy so no chown layer is needed.
COPY --from=build --chown=node:node /deploy/node_modules ./node_modules
COPY --from=build --chown=node:node /deploy/dist ./dist
COPY --from=build --chown=node:node /deploy/package.json ./package.json

USER node

EXPOSE 3000

# Liveness, not readiness: this probe answers "is the process still serving?".
# Whether Postgres and Redis are reachable is /health/ready's job, and it is
# the load balancer's business — a database blip should not make Docker or ECS
# kill an otherwise healthy container. The path is built from API_PREFIX
# because the app mounts every route under it, with URI versioning on top.
# Written as a node one-liner so the image needs no curl and no wget.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/' + process.env.API_PREFIX + '/v1/health/live').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Exec form, so node is PID 1 and receives SIGTERM directly. NestJS's
# enableShutdownHooks() installs the handler that drains in-flight requests and
# closes Redis, Prisma and the Socket.IO adapter before exiting — which is what
# makes an ECS rolling deploy safe. Never wrap this in a shell.
CMD ["node", "dist/main.js"]
