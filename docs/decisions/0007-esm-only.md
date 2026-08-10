# 7. ESM only

Status: accepted

## Context

Node.js has two module systems and a decade of interop rules between them. A TypeScript
project can compile to CommonJS and ignore the question, at the price of being permanently on
the legacy side of the ecosystem: an increasing number of packages ship ESM-only, dynamic
`import()` of them from CJS is awkward, and `require(esm)` support is recent.

NestJS's own tooling has historically assumed CommonJS — decorators, `reflect-metadata` and
`emitDecoratorMetadata` all predate ESM being practical — so choosing ESM for a Nest app is
choosing to be slightly off the beaten path.

## Decision

Every workspace package declares `"type": "module"` — `apps/api`, `apps/web`, `apps/admin`,
`apps/docs`, `packages/shared`, `lambdas/example`. No package compiles to CommonJS.

```bash
grep -l '"type": "module"' apps/*/package.json packages/*/package.json lambdas/*/package.json
```

- `apps/api` and `packages/shared` use `"module": "nodenext"` with
  `"moduleResolution": "nodenext"` — real Node ESM resolution, which means **every local
  import carries an explicit `.js` extension**, including imports through path aliases:
  `import { configureApp } from '@helpers/configure-app.helper.js';`. This is applied without
  exception; a grep for extension-less local imports across `apps/api/src` and `apps/api/test`
  returns nothing.
- The frontends use `"module": "ESNext"` with `"moduleResolution": "bundler"`, because Vite
  resolves, not Node.
- The API is type-checked by `tsc --noEmit` and **emitted by SWC**, not by `tsc`. Dev reload is
  `swc -w` plus `node --watch dist/main.js`. There is no `ts-node` and no `tsx` in the run
  path (`tsx` exists solely to execute the Prisma seed script).
- Tests run on Vitest, which is natively ESM.

The one piece of machinery that makes this work at runtime is `apps/api/.swcrc`:

```json
"module": { "type": "nodenext", "resolveFully": true }
```

`resolveFully` rewrites every path alias to a fully-resolved relative specifier at build time.
That is what allows ten path aliases to work under real Node ESM with **no loader hook, no
`tsconfig-paths/register`, and no `imports` map in `package.json`**.

## Consequences

**Good**

- No interop layer in the application code. Nothing under `apps/`, `packages/` or `lambdas/`
  reaches for a CommonJS escape hatch, and there is no `--experimental-*` or `--loader` flag
  in the Dockerfile or the compose file. Check it:

  ```bash
  grep -rnE 'createRequire|require\(|module\.exports|export =|__dirname|__filename' \
    apps packages lambdas \
    --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=generated
  ```

  The one exception is deliberate and outside the application: `scripts/benchmark.mjs` builds
  a `createRequire` to read `autocannon/package.json` for the version it stamps into a report.
  A JSON import would need `with { type: 'json' }` and a matching Node version floor for a
  line of reporting metadata, so the escape hatch is the cheaper trade. Drop `scripts` from
  the paths above and the command prints nothing.
- ESM-only dependencies can be adopted without ceremony.
- `resolveFully` means the deployed artifact has no runtime dependency on the alias table.

**Bad — pay these knowingly**

- **The alias table is duplicated three times** and nothing keeps the copies in sync:
  `apps/api/tsconfig.json` `paths`, `apps/api/.swcrc` `paths`, and `vite-tsconfig-paths` for
  Vitest. Adding an alias means editing all three, and forgetting one produces a
  type-checks-but-crashes-at-runtime failure.
- **`verbatimModuleSyntax` is off for the API**, and `biome.json` correspondingly disables the
  `useImportType` lint rule for `apps/api/**`. This is a deliberate carve-out:
  `emitDecoratorMetadata` needs *value* imports for injected types, and `verbatimModuleSyntax`
  would erase them. So the strictest ESM setting in the repo is the one the Nest app cannot
  have. The frontends do enable it.
- **Vitest needs a bespoke plugin pipeline for the API**, duplicated across the unit and e2e
  configs: `tsconfigPaths()` because Vitest does not read `.swcrc`, and
  `swc.vite({ module: { type: 'nodenext' } })` because Vite's default esbuild transform does
  not emit the `design:type` decorator metadata that Nest's DI requires. The frontends need
  neither.
- **`reflect-metadata` has to be imported before anything decorated is loaded**, and under ESM
  that ordering is not something the module graph gives you for free. The runtime gets it from
  the first line of `main.ts`; the test runs get it from
  `apps/api/test/reflect-metadata.setup.ts`, which both Vitest configs load through
  `setupFiles`. Three explicit imports for one polyfill is the ESM tax:

  ```bash
  grep -rn "reflect-metadata" apps/api/src apps/api/test apps/api/vitest.config.ts
  ```
- **JSON cannot be imported statically without extra configuration.** One spec reads its
  fixtures off disk with `fileURLToPath(new URL(..., import.meta.url))` and `JSON.parse`
  precisely to avoid depending on `resolveJsonModule`. That is the ESM tax showing up in test
  code.

**Where the rule is bent**

- **The workspace root has no `"type": "module"`.** It sidesteps the question by naming every
  root-level script `.mjs` (`scripts/bootstrap.mjs`, `scripts/subtraction-test.mjs`,
  `commitlint.config.mjs`). `lambdas/example` wears both belt and braces — `.mjs` *and*
  `"type": "module"`.
- **"Path aliases only" is enforced, but only in `apps/api/src`.** `biome.json` carries a
  `style/noRestrictedImports` rule at `error` that blocks the `./**` and `../**` patterns
  there, so a relative import fails `pnpm exec biome ci .` rather than review. Two gaps are
  deliberate and worth knowing: the rule's `includes` covers `apps/api/src/**` and **not**
  `apps/api/test/**`, so an e2e spec may still import relatively; and the frontends are
  exempt on purpose, because they declare no aliases at all and import relatively by
  convention. So the sentence is true where it is checked and a convention everywhere else.

  ```bash
  grep -n -A12 noRestrictedImports biome.json
  ```
