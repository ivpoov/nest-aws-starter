# CLAUDE.md

AWS-native NestJS + React full-stack starter. pnpm-workspaces monorepo + Turborepo.

## Commands
- `pnpm run build | lint | test | test:e2e` — via turbo, from root
- `docker compose up -d` — Postgres, Redis, LocalStack, MinIO
- `pnpm run db:generate | db:migrate` — inside apps/api

## Binding rules
- Read `docs/conventions/backend.md` BEFORE writing any backend code.
- Prisma never leaves repositories. Services speak domain interfaces only.
- Explicit types on every local variable. Path aliases only. Coded error constants.
- Conventional commits, granular (one logical unit), subject line only.
- Every module ships unit + e2e tests in the same commit series.
