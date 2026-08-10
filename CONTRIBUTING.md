# Contributing

Thanks for taking an interest in this project. This file is the **map**: how work
flows through the branches, how commits and pull requests are shaped, which
commands you are expected to run before you push, and what CI will do to you if
you don't.

It deliberately does **not** restate the code rules. Those live in
`docs/conventions/`, one file per boundary, and those files are the single
source of truth for what the code must look like:

- [`backend.md`](./docs/conventions/backend.md) — `apps/api`.
- [`frontend.md`](./docs/conventions/frontend.md) — `apps/web`, `apps/admin`.
- [`shared-contracts.md`](./docs/conventions/shared-contracts.md) —
  `packages/shared`.

Read the one that covers what you are about to touch. This file is the only
place the branch model, commit format and PR rules are written down, so nothing
below is repeated there. Anything about running the project locally
(prerequisites, env files, ports, compose profiles) lives in the
[README](./README.md).

## Before you start

- **Node 24** — pinned in [`.nvmrc`](./.nvmrc); `nvm use` picks it up.
- **pnpm 11** via corepack — `corepack enable && corepack install`.
- **Docker** with the compose plugin, for anything that touches the e2e suite.
- Read the convention file for the workspace you are about to change (listed
  above). They are the law of this repository, and reviewers apply them
  literally.

## Branch model

Three long-lived branches, in one direction only:

```
feature/… fix/… chore/… ──▶ dev ──▶ staging ──▶ main
```

| Branch | Role |
|---|---|
| `dev` | Integration branch and the repository default. Every change lands here first. |
| `staging` | Release candidate. Pushes here also trigger the subtraction workflow. |
| `main` | Released code. Every release tag (`v0.1.0` … `v0.5.0`) points at a merge commit on `main`. |

**Branch off `dev`, always.** Never off `staging` or `main`. Name the branch with
the same prefix as the commit type that dominates it — real examples from this
repository's history:

```
feature/notification-dispatcher
feature/websocket-gateway
fix/impersonation-absolute-cap
chore/e2e-preflight
ci/subtraction-test
```

Open the pull request against `dev`. Releases move through the same machinery:
one PR from `dev` to `staging`, then one from `staging` to `main`, then the tag
on `main`. Nothing is committed directly to a long-lived branch.

## Commits

Conventional Commits, enforced by [`@commitlint/config-conventional`](./commitlint.config.mjs)
through the [`commit-msg` hook](./.husky/commit-msg) — a malformed message is
rejected locally before it can reach a branch.

```
<type>(<scope>): <subject>
```

**Subject line only.** No body, no footers, no trailers, no co-author or tool
attribution. The only multi-line messages in this history are merge commits, and
Git writes those itself.

**One logical unit per commit** — a contract, a service, a migration. If you
can't describe the commit without "and", split it.

Types in use here: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci`,
`style`. The scope is the workspace or module you touched (`api`, `web`,
`admin`, `shared`, or a module name like `notification`, `payment`); use a
comma-separated list when a change genuinely spans two, and omit the scope only
for repository-wide changes. Write the subject in the imperative, lower case, no
trailing period, and say what the change *does* rather than which files moved.

Verbatim examples from this repository:

```
feat(notification): throttle notification emails to one per user, type and hour
fix(notification): paginate the history feed by keyset so a filter cannot drop a row
test(api): type-check the e2e suite via a dedicated tsconfig
refactor(web,admin): type the notification list request with the shared query contract
docs(conventions): require keyset pagination for filtered cursor lists
chore(admin): pin socket.io-client to match web and the api
style(notification): annotate the webhook error cap length explicitly
fix(deps): override js-yaml to patch the omap cpu advisory
ci: type-check the api e2e suite on every pull request
```

## Pull request sizing

The size limits in [`docs/conventions/backend.md` §3](./docs/conventions/backend.md)
are review-enforced, and two of them are about you rather than the code:

- **One concern per PR.** A PR whose title needs "and" is two PRs.
- **Target ≤ ~400 changed lines** of hand-written code. Generated artefacts
  (`pnpm-lock.yaml`, the recipes under `docs/removal/`) belong in the PR that
  caused them and are read as generated, not authored.
- **Tests ship with the code**, in the same PR — not a follow-up. Every module
  ships unit *and* e2e tests.
- **Docs ship with the behaviour.** If you changed an env var, an endpoint or a
  *fence marker* — the `// <module:x>` comment that marks a line or block as
  belonging to an optional module, so removing the module can delete it
  mechanically ([the subtraction test](#the-subtraction-test) below) — the
  README, `docs/conventions/` or the regenerated `docs/removal/` recipes change
  in the same PR.

Title the PR the same way you title a commit — `feat(api): per-type
notification preferences with email channel` is a real one.

## Running the suites

Everything below has been run from a clean checkout at the repository root.

### One-time setup

```bash
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env   # works as-is against the compose stack
docker compose up -d --wait              # Postgres, Redis, LocalStack, MinIO
pnpm --dir apps/api run db:migrate
```

`docker compose up -d --wait` blocks until every service reports healthy. The
`db:migrate` step is not optional even for a "frontend-only" change: the API
build runs `prisma generate --sql`, which type-checks TypedSQL queries against a
real database, so an unmigrated Postgres fails the build.

### The checks

| Command | What it does | Needs Docker |
|---|---|---|
| `pnpm exec biome ci .` | Lint + format check over the whole repo — exactly what CI runs | no |
| `pnpm run lint` | Per-workspace `biome check src` via turbo | no |
| `pnpm run format` | Rewrites files to the formatter's output | no |
| `pnpm run build` | turbo fan-out: api (`prisma generate --sql` + `tsc` + swc), web/admin (`tsc` + vite), shared (`tsc`) | yes |
| `pnpm run test` | Unit suites for api, web and admin | yes (via the build it depends on) |
| `pnpm --dir apps/api exec tsc --noEmit -p tsconfig.e2e.json` | Type-checks the e2e suite, which `pnpm run build` deliberately excludes | no |
| `pnpm run test:e2e` | supertest against the real app with Postgres, Redis, LocalStack and MinIO | **yes** |
| `node scripts/subtraction-test.mjs` | Deletes each optional module in its own worktree and rebuilds what's left | yes (run `pnpm run build` first) |

The short version, for a change that doesn't touch the API:

```bash
pnpm exec biome ci .
pnpm run test
```

And the full local gate, matching CI:

```bash
pnpm exec biome ci .
pnpm run build
pnpm run test
pnpm --dir apps/api exec tsc --noEmit -p tsconfig.e2e.json
pnpm run test:e2e
```

If `test:e2e` aborts with `E2E PREFLIGHT: LocalStack is up but missing: ...`,
your LocalStack container is stale — the README's
[Testing section](./README.md#testing) has the one-line fix.

### The subtraction test

This repository claims every optional module can be deleted cleanly, and
[`scripts/subtraction-test.mjs`](./scripts/subtraction-test.mjs) is what makes
that claim checkable. It reads the `// <module:x>` fence markers, deletes each
module in an isolated git worktree, and rebuilds and unit-tests what remains.

```bash
pnpm run build                                      # produces the generated Prisma client it copies
node scripts/subtraction-test.mjs                   # every module (slow — minutes per module)
node scripts/subtraction-test.mjs --module payment  # just one, while iterating
node scripts/subtraction-test.mjs --emit-docs       # regenerate docs/removal/*.md, no worktrees
```

**If you add, remove or move a cross-module reference, re-run `--emit-docs` and
commit the result.** CI regenerates the recipes on every pull request and fails
on any diff, so forgetting this fails your PR rather than the next nightly run.
See [`docs/removal/README.md`](./docs/removal/README.md) for what the recipes
prove and what they only document.

## What CI gates

Everything in [`.github/workflows/`](./.github/workflows). Three of them have
something to say about a pull request; the rest are release and deployment
machinery that only runs after a merge.

**[`ci.yml`](./.github/workflows/ci.yml)** — every pull request, plus pushes to
`main`. Four jobs run in parallel:

- **lint** — `pnpm install --frozen-lockfile`, then `pnpm exec biome ci .`.
- **test** — brings up the compose stack with `--wait`, migrates, then runs
  `pnpm run build`, `pnpm run test`, the e2e type-check
  (`tsc --noEmit -p tsconfig.e2e.json`) and `pnpm run test:e2e` against real
  Postgres, Redis, LocalStack and MinIO.
- **bootstrap** — runs `scripts/bootstrap.mjs --dry-run` on the checkout and
  asserts it wrote nothing. The README's headline command is the first thing a
  newcomer runs, so it is worth a job of its own.
- **audit** — `pnpm audit --prod --audit-level high`, then
  `pnpm run license-check`. A new high-severity advisory in a production
  dependency, or a dependency that relicensed under you, fails the build — so
  patching, overriding or replacing it is part of the PR.

In-progress runs are cancelled when you push again to the same ref.

**[`subtraction.yml`](./.github/workflows/subtraction.yml)** — split in two,
because its halves cost very different things:

- **docs-drift** runs on **every pull request**. It re-emits the removal recipes
  and fails if `docs/removal` drifted from the fence markers. No install, no
  database, no worktrees — seconds.
- **subtraction** runs nightly at 03:00 UTC, on pushes to `staging` and `main`,
  and on manual dispatch. It runs `scripts/subtraction-test.mjs` across every
  module, each in its own worktree, and is far too slow for a pull request.

So a forgotten `--emit-docs` fails your PR, but an unfenced cross-reference that
breaks an actual removal will not surface until the nightly run — which is the
case where running the full script locally still matters.

**[`docs.yml`](./.github/workflows/docs.yml)** — builds the documentation site
when a pull request touches `docs/**` or `apps/docs/**`, and publishes it to
GitHub Pages from `main`.

## Definition of done

A change is done when all of the following are true:

- [ ] It follows the conventions for every workspace it touches —
      [`backend.md`](./docs/conventions/backend.md),
      [`frontend.md`](./docs/conventions/frontend.md),
      [`shared-contracts.md`](./docs/conventions/shared-contracts.md).
- [ ] Unit tests cover it, and e2e tests cover any new or changed endpoint — in
      this PR, not the next one.
- [ ] `pnpm exec biome ci .`, `pnpm run build`, `pnpm run test`, the e2e
      type-check and `pnpm run test:e2e` all pass locally.
- [ ] Docs that describe the changed behaviour changed with it, and
      `docs/removal/` was regenerated if you touched a fence marker.
- [ ] Commits are conventional, granular, and subject-line only.
- [ ] The PR is one concern, and CI is green on it.

Green CI is the floor, not the goal — the review will still ask whether the
change belonged in one PR.
