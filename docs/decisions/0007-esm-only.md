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

Every publishable package declares `"type": "module"`: `apps/api`, `apps/web`, `apps/admin`,
`packages/shared`, `lambdas/example`. No package compiles to CommonJS.

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

- No interop layer at all. There is not a single `createRequire`, `require(`, `module.exports`,
  `export =`, `__dirname` or `__filename` anywhere in `apps/`, `packages/`, `scripts/` or
  `lambdas/`, and no `--experimental-*` or `--loader` flag in the Dockerfile or compose file.
  For a Nest application on ESM that is an unusually clean result.
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
- **`reflect-metadata` is imported in exactly one place** (`main.ts`) and neither Vitest config
  declares a `setupFiles` that imports it — specs rely on it arriving transitively through
  `@nestjs/*`. That works today and is an unstated dependency, not a decision.
- **JSON cannot be imported statically without extra configuration.** One spec reads its
  fixtures off disk with `fileURLToPath(new URL(..., import.meta.url))` and `JSON.parse`
  precisely to avoid depending on `resolveJsonModule`. That is the ESM tax showing up in test
  code.

**Where the rule is bent**

- **The workspace root has no `"type": "module"`.** It sidesteps the question by naming every
  root-level script `.mjs` (`scripts/bootstrap.mjs`, `scripts/subtraction-test.mjs`,
  `commitlint.config.mjs`). `lambdas/example` wears both belt and braces — `.mjs` *and*
  `"type": "module"`.
- **"Path aliases only; relative imports are lint-blocked" is not true.** `main.ts` imports
  `./app.module.js` relatively, and — more importantly — **there is no such lint rule**.
  `biome.json` contains no `noRestrictedImports` and no import-path rule of any kind. The
  claim in the README is aspirational.
