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

Eleven modules are optional and fenced. Everything else — `user`, `auth`, `session`, `token`,
`casl`, `event`, `common`, `activity`, `account-security`, `oauth` core — is core and has
no markers.

Every count in this document is quoted as the command that produces it rather than as a
number, because a number in a document has no way to notice that the code moved. Run this one
to see how many fence sites each module has:

```bash
# One line per module, counting opening markers — a trailing marker and a
# block each count once. `<module:x>` is the placeholder used in comments that
# explain the convention; it is not a real module.
grep -rEho '<module:[a-z0-9-]+>' \
  apps/api/src apps/api/test apps/api/prisma/schema.prisma apps/api/prisma/seed.ts \
  apps/web/src apps/admin/src packages/shared/src \
  --include='*.ts' --include='*.tsx' --include='*.prisma' --exclude-dir=generated \
  | sort | uniq -c | sort -rn
```

At the time of writing that put `payment` an order of magnitude above the OAuth providers,
which is the shape that matters: the cost of the convention is concentrated in one module.

`scripts/subtraction-test.mjs` is the proof. For each module it deletes the module's own
files in a throwaway git worktree, strips that module's fences everywhere else, then
type-checks `apps/api` (including the e2e suite via `tsconfig.e2e.json`), `apps/web`,
`apps/admin` and `packages/shared`, and runs their unit tests. The same script emits
`docs/removal/` with `--emit-docs`.

### What this constrains

This is the part that matters when you add code, and it is stricter than "keep it tidy":

1. **A core module may not import an optional module.** The core API modules carry no fence
   markers at all — this prints nothing:

   ```bash
   grep -rE '<module:' apps/api/src/modules/{user,auth,session,casl,activity,oauth}
   ```

   Fences outside an optional module's own folder are not confined to composition files,
   though. They are concentrated there — `app.module.ts` and `configs/index.ts` carry the most
   by a wide margin, and `main.ts` and one block in
   `common/constants/development-defaults.constants.ts` account for the rest inside
   `apps/api/src` — but the same markers also reach the Prisma schema and seed, the e2e suite,
   both frontends' route tables and the shared barrel. This lists every such file, largest
   first:

   ```bash
   grep -rcE '<module:' \
     apps/api/src apps/api/test apps/api/prisma/schema.prisma apps/api/prisma/seed.ts \
     apps/web/src apps/admin/src packages/shared/src \
     --include='*.ts' --include='*.tsx' --include='*.prisma' --exclude-dir=generated \
     | grep -vE '/modules/(payment|notification|file|contact-us|note|statistic|api-key|oauth-[a-z]+)/' \
     | grep -v ':0$' | sort -t: -k2 -rn
   ```
2. **The sanctioned way for core to react to an optional feature is a domain event, not an
   import.** `event-names.constants.ts` fences exactly one of its constants
   (`NOTE_CREATED_EVENT`) — compare
   `grep -c '^export const' apps/api/src/modules/event/constants/event-names.constants.ts`
   with the single `<module:note>` in the same file.
   `CONTACT_RECEIVED_EVENT`, `FILE_UPLOADED_EVENT`, the `API_KEY_*`
   pair, all five `SUBSCRIPTION_*` events and `WEBHOOK_FAILED_EVENT` belong to optional
   modules but sit unfenced in the core event bus — because the core `activity` module
   subscribes to them, and an unfired listener for a deleted module is inert rather than
   broken. `NOTE_CREATED_EVENT` is fenced only because nothing listens for it.
3. **Optional → optional references are allowed, fenced inline, including in constructors.**
   `FileService` fences two constructor-injected parameters and the branch that uses them for
   the optional `cloudfront` module.
4. **The shared wire-contract barrel is fenced line by line** — well over half the `export *`
   lines in `packages/shared/src/index.ts` carry a marker:

   ```bash
   grep -c '^export \*' packages/shared/src/index.ts                        # total
   grep '^export \*' packages/shared/src/index.ts | grep -c '<module:'      # fenced
   ```

   The unfenced remainder is core contract, plus a few surgical exceptions: the
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

- **Markers are noise in the source.** Reading `app.module.ts` or
  `packages/shared/src/index.ts` means reading dozens of comments that say nothing about what
  the code does. The repository-wide total:

  ```bash
  grep -rEho '<module:[a-z0-9-]+>' \
    apps/api/src apps/api/test apps/api/prisma/schema.prisma apps/api/prisma/seed.ts \
    apps/web/src apps/admin/src packages/shared/src \
    --include='*.ts' --include='*.tsx' --include='*.prisma' --exclude-dir=generated \
    | grep -v '<module:x>' | wc -l
  ```
- **The proof itself is not enforced on pull requests.** `.github/workflows/subtraction.yml`
  splits into two jobs. The doc-drift check (`--emit-docs` then `git diff --exit-code`) is
  cheap — no install, no database, no worktrees — and runs on **every** pull request, so a
  recipe can no longer fall out of step with the markers. The removal proof itself is one
  `pnpm install` + type-check + unit-test pass *per module*, which is far too slow for that,
  so it stays nightly and on pushes to `staging`/`main`. **A PR that adds an unfenced
  cross-reference still merges green** — the markers it forgot to write are markers the drift
  check has nothing to compare against — and breaks the nightly job hours later.
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
- `manualPaths` — the bucket for folders a removal must delete that the script deliberately
  does not — is empty for every module, and has been since the `packages/shared/src/index.ts`
  export lines were fenced. It is kept because `assertFrontendFencedClaims()` uses it as a
  tripwire: an entry cannot claim `frontendFenced` while listing one.
- The v0.1 infrastructure providers (`s3`, `sqs`, `sns`, `mail`, `lambda`) predate the
  convention and are explicitly out of scope. `mail` is the honest worst case: `EmailFlowService`
  calls `MAIL_TRANSPORT` unconditionally, so removing mail outright breaks core auth flows.
  They are optional in the sense of having a disabled fallback, not in the sense of being
  removable.
