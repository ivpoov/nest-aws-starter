# CLAUDE.md

AWS-native NestJS + React full-stack starter. pnpm-workspaces monorepo + Turborepo.

## Commands
- `pnpm run build | lint | test | test:e2e` — via turbo, from root
- `docker compose up -d` — Postgres, Redis, LocalStack, MinIO
- `pnpm run db:generate | db:migrate` — inside apps/api

## Binding rules
- Read `docs/conventions/backend.md` BEFORE writing any backend code.
- Read `docs/conventions/frontend.md` BEFORE writing any `apps/web` or `apps/admin` code.
- Read `docs/conventions/shared-contracts.md` BEFORE touching `packages/shared` — a
  contract change breaks the API and both frontends at once, so all three move together.
- Prisma never leaves repositories. Services speak domain interfaces only.
- Explicit types on every local variable. Coded error constants.
- Imports: path aliases only in `apps/api` (`@modules/...`); the frontends use
  relative imports and declare no aliases — do not mix the two.
- Conventional commits, granular (one logical unit), subject line only.
- Every module ships unit + e2e tests in the same commit series.
- Branch model, PR sizing and the local/CI gate live in `CONTRIBUTING.md`.
