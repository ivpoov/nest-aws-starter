# 8. Modular by subtraction

Status: accepted

## Context

A starter is only useful if you can delete the parts you do not need. Most starters address
this with feature flags or with a plugin architecture, and both age badly: flags accumulate
until every code path is conditional, and a plugin API has to be designed before anyone knows
what the plugins will need.

The alternative is to ship everything working and make **removal** the supported operation.
That only works if removal is mechanical, which means every place an optional feature touches
a non-optional one has to be visible and machine-findable.

## Decision

Optional modules are delimited by fence markers.

- A trailing `// <module:payment>` on a line means *delete this line*.
- An own-line `// <module:payment>` … `// </module:payment>` pair means *delete this block*.
- Inside JSX the same markers appear as `{/* <module:x> */}`, because a `//` comment is a
  syntax error where a frontend cross-reference actually lives — inside a component's
  children.

Eleven modules are optional and fenced: `payment` (93 markers), `notification` (43), `file`
(26), `contact-us` (26), `cloudfront` (19), `note` (15), `statistic` (12), `api-key` (11), and
the three OAuth providers (4 each). Everything else — `user`, `auth`, `session`, `token`,
`casl`, `event`, `common`, `activity`, `account-security`, `oauth` core — is core and has
no markers.

`scripts/subtraction-test.mjs` is the proof. For each module it deletes the module's own
files in a throwaway git worktree, strips that module's fences everywhere else, then
type-checks `apps/api` (including the e2e suite via `tsconfig.e2e.json`), `apps/web`,
`apps/admin` and `packages/shared`, and runs their unit tests. The same script emits
`docs/removal/` with `--emit-docs`.

### What this constrains

This is the part that matters when you add code, and it is stricter than "keep it tidy":

1. **A core module may not import an optional module.** Verified: there are zero fence markers
   inside `modules/user`, `modules/auth`, `modules/session`, `modules/casl`,
   `modules/activity` and `modules/oauth`. The only fences outside optional-module folders are
   in composition files — `app.module.ts` (25 markers), `configs/index.ts` (15), `main.ts`,
   and one block in `common/constants/development-defaults.constants.ts`.
2. **The sanctioned way for core to react to an optional feature is a domain event, not an
   import.** `event-names.constants.ts` fences exactly one of its 24 constants
   (`NOTE_CREATED_EVENT`). `CONTACT_RECEIVED_EVENT`, `FILE_UPLOADED_EVENT`, the `API_KEY_*`
   pair, all five `SUBSCRIPTION_*` events and `WEBHOOK_FAILED_EVENT` belong to optional
   modules but sit unfenced in the core event bus — because the core `activity` module
   subscribes to them, and an unfired listener for a deleted module is inert rather than
   broken. `NOTE_CREATED_EVENT` is fenced only because nothing listens for it.
3. **Optional → optional references are allowed, fenced inline, including in constructors.**
   `FileService` fences two constructor-injected parameters and the branch that uses them for
   the optional `cloudfront` module.
4. **The shared wire-contract barrel is fenced line by line** — 82 of the 108 `export *` lines
   in `packages/shared/src/index.ts` carry a marker. The exceptions are surgical: the
   `FileIntentEnum` export is deliberately unfenced because core `activity` payloads use it.
5. **The Prisma schema is fenced too**, down to individual relation fields on the core `User`
   model (`notes Note[] // <module:note>`).

## Consequences

**Good**

- Removal is a recipe, not an archaeology project. Every optional module has a generated page
  in `docs/removal/` listing exactly what to delete and what to hand-edit.
- The proof is real for the parts it covers: the subtracted tree is type-checked across all
  four packages and unit-tested.
- The constraint has a healthy side effect — it pushes cross-module coupling onto the event
  bus, which is where you want it anyway.

**Bad — pay these knowingly**

- **Markers are noise in the source.** 257 of them. Reading `app.module.ts` means reading
  25 trailing comments; reading `packages/shared/src/index.ts` means reading 82.
- **The convention is not enforced on pull requests.** `.github/workflows/subtraction.yml`
  runs nightly and on pushes to `staging`/`main`, and its own header says it is too slow to
  run per PR. The doc-drift check (`--emit-docs` then `git diff --exit-code`) runs on the same
  schedule. **A PR that adds an unfenced cross-reference merges green** and breaks the nightly
  job hours later.
- **A malformed marker fails silently, in the worst possible way.** `stripFencesInFile` never
  checks that fences balance: an opening marker with no closing marker leaves the stripper in
  block mode to end of file and **silently deletes the rest of the file**. A misspelled module
  id (`<module:payments>`) matches nothing and is a no-op that no check reports.
- **What cannot be fenced cannot be proven.** The fence scanner only looks at `.ts`, `.tsx`
  and `.prisma` files under a fixed set of roots. `.env.example`, `docker-compose.yml`,
  `turbo.json` and `package.json` are structurally unfenceable, so their entries become
  hand-edit steps in the recipe — unproven by construction.
- **The e2e suite is type-checked, never executed.** It needs a live Postgres/Redis/LocalStack
  that a throwaway worktree does not have. Running `test:e2e` after a removal stays a human's
  job, and the removal docs say so.

**Where the claim overreaches**

- `docs/removal/README.md` states "every module is fully fence-marked and fully proven".
  That sentence is about *frontend* fences. `notification` still carries hand-edit steps for
  `apps/api/test/vitest.e2e.config.ts` and `turbo.json` — and the first of those is a `.ts`
  file inside a fence-scan root, i.e. it could have been fenced and was not. The
  `assertFrontendFencedClaims()` guard only inspects `apps/web/`, `apps/admin/` and
  `packages/shared/`, so an `apps/api` hand-edit never blocks the `frontendFenced` flag.
- The script's header comment describing `manualPaths` — and therefore the corresponding
  paragraph in every generated recipe — is stale: it tells the reader that
  `packages/shared/src/index.ts` re-exports through unfenced `export *` lines, which has not
  been true since those lines were fenced.
- The v0.1 infrastructure providers (`s3`, `sqs`, `sns`, `mail`, `lambda`) predate the
  convention and are explicitly out of scope. `mail` is the honest worst case: `EmailFlowService`
  calls `MAIL_TRANSPORT` unconditionally, so removing mail outright breaks core auth flows.
  They are optional in the sense of having a disabled fallback, not in the sense of being
  removable.
