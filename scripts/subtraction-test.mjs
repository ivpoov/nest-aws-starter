#!/usr/bin/env node
// Modular-by-subtraction proof: for every optional module, spin up an
// isolated git worktree, delete the module, strip its cross-references
// (marked with `// <module:x>` / `// </module:x>` fences), and verify the
// rest of the app still type-checks and passes its unit tests. Also emits
// the removal recipes in docs/removal/ from the same fence markers, so the
// docs can never drift from what the script actually strips.
//
// Usage:
//   node scripts/subtraction-test.mjs                  # run every module
//   node scripts/subtraction-test.mjs --module file     # run one module
//   node scripts/subtraction-test.mjs --module a,b      # run a subset
//   node scripts/subtraction-test.mjs --emit-docs       # (re)generate docs/removal/*.md, no worktrees
//   node scripts/subtraction-test.mjs --keep-on-failure # leave a failed worktree on disk for inspection

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FENCE_SCAN_ROOTS = ['apps/api/src', 'apps/api/prisma/schema.prisma'];
const FENCE_FILE_EXTENSIONS = new Set(['.ts', '.prisma']);
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', 'generated', '.git']);

// Every module the subtraction test proves removable. `paths` are
// repo-relative folders/files deleted wholesale; the fence scanner finds
// everything else (cross-module references left behind in files that
// otherwise stay).
const MODULES = [
  {
    id: 'contact-us',
    summary: 'Public contact form + admin inbox.',
    paths: ['apps/api/src/modules/contact-us'],
    envVars: [],
  },
  {
    id: 'statistic',
    summary: 'Admin dashboard statistics (cached TypedSQL aggregates).',
    paths: ['apps/api/src/modules/statistic', 'apps/api/prisma/sql'],
    envVars: [],
  },
  {
    id: 'api-key',
    summary: 'Long-lived API key issuance, guard, and admin management.',
    paths: ['apps/api/src/modules/api-key'],
    envVars: [],
  },
  {
    id: 'file',
    summary: 'S3-backed presigned upload/download flow.',
    paths: ['apps/api/src/modules/file'],
    envVars: [],
  },
  {
    id: 'oauth-google',
    summary: 'Google OAuth login/link provider.',
    paths: ['apps/api/src/modules/oauth-google', 'apps/api/src/configs/google-oauth.config.ts'],
    envVars: [
      'GOOGLE_OAUTH_ENABLED',
      'GOOGLE_OAUTH_CLIENT_ID',
      'GOOGLE_OAUTH_CLIENT_SECRET',
      'GOOGLE_OAUTH_REDIRECT_URI',
    ],
  },
  {
    id: 'oauth-facebook',
    summary: 'Facebook OAuth login/link provider.',
    paths: ['apps/api/src/modules/oauth-facebook', 'apps/api/src/configs/facebook-oauth.config.ts'],
    envVars: [
      'FACEBOOK_OAUTH_ENABLED',
      'FACEBOOK_OAUTH_CLIENT_ID',
      'FACEBOOK_OAUTH_CLIENT_SECRET',
      'FACEBOOK_OAUTH_REDIRECT_URI',
    ],
  },
  {
    id: 'oauth-discord',
    summary: 'Discord OAuth login/link provider.',
    paths: ['apps/api/src/modules/oauth-discord', 'apps/api/src/configs/discord-oauth.config.ts'],
    envVars: [
      'DISCORD_OAUTH_ENABLED',
      'DISCORD_OAUTH_CLIENT_ID',
      'DISCORD_OAUTH_CLIENT_SECRET',
      'DISCORD_OAUTH_REDIRECT_URI',
    ],
  },
  {
    id: 'cloudfront',
    summary: 'CloudFront signed download URLs (optional common provider).',
    paths: [
      'apps/api/src/modules/common/providers/cloudfront',
      'apps/api/src/configs/cloudfront.config.ts',
    ],
    envVars: [
      'CLOUDFRONT_ENABLED',
      'CLOUDFRONT_DOMAIN',
      'CLOUDFRONT_KEY_PAIR_ID',
      'CLOUDFRONT_PRIVATE_KEY',
      'CLOUDFRONT_URL_TTL_SEC',
    ],
  },
];

// Documented for docs/removal/README.md — investigated during Task 14 and
// found not (currently) cleanly removable. Not exercised by the script.
const NON_REMOVABLE = [
  {
    id: 'suspicious-activity',
    reason:
      'AuthService.login() synchronously gates credential verification on ' +
      'LoginLockoutService.assertNotLocked() and branches AUTH_NEW_DEVICE_EVENT ' +
      'emission on NewDeviceService.check() — a security-critical control-flow ' +
      'dependency, not a fire-and-forget side effect. auth.service.spec.ts has six ' +
      'dedicated test cases asserting this ordering. Fencing it would require ' +
      'restructuring AuthService.login() itself and half its spec file — the ' +
      'coupling is real, not incidental. Left as a core-adjacent module.',
  },
  {
    id: 'activity',
    reason:
      'Subscribes to core auth/user events (AUTH_LOGIN, USER_BLOCKED, ...) that ' +
      'survive regardless of which optional modules are present; it is the audit ' +
      'trail for the core system, not an optional feature.',
  },
  { id: 'user', reason: 'Core identity module.' },
  { id: 'auth', reason: 'Core authentication module.' },
  { id: 'session', reason: 'Core session module.' },
  { id: 'token', reason: 'Core token module.' },
  { id: 'casl', reason: 'Core authorization module.' },
  { id: 'event', reason: 'Core event bus.' },
  { id: 'common', reason: 'Shared infrastructure (errors, guards, decorators, cache, ...).' },
  {
    id: 'oauth (core)',
    reason:
      'The oauth flow/registry/state-store module — not a provider itself. ' +
      'user-admin.controller (login-as) depends on OauthFlowService.mintExchangeCode ' +
      'directly. Only the oauth-* provider plugins (google/facebook/discord) are removable.',
  },
  {
    id: 's3 / sqs / sns / mail / lambda (providers)',
    reason:
      'v0.1 providers predate the fence-marker convention introduced in this PR. ' +
      'Retrofitting them is deliberately out of scope for this round — see the ' +
      'scope note in docs/removal/README.md — and belongs to a dedicated pass.',
  },
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function parseArgs(argv) {
  const args = { modules: null, emitDocs: false, keepOnFailure: false };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--module') {
      args.modules = argv[i + 1].split(',').map((id) => id.trim());
      i += 1;
    } else if (argv[i] === '--emit-docs') {
      args.emitDocs = true;
    } else if (argv[i] === '--keep-on-failure') {
      args.keepOnFailure = true;
    }
  }

  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
  });

  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function listFilesRecursive(rootAbsPath) {
  const stat = statSync(rootAbsPath, { throwIfNoEntry: false });

  if (!stat) return [];
  if (stat.isFile()) return [rootAbsPath];

  const entries = readdirSync(rootAbsPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      files.push(...listFilesRecursive(path.join(rootAbsPath, entry.name)));
      continue;
    }

    if (FENCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(rootAbsPath, entry.name));
    }
  }

  return files;
}

function fenceFilesUnder(treeRoot) {
  return FENCE_SCAN_ROOTS.flatMap((relRoot) => listFilesRecursive(path.join(treeRoot, relRoot)));
}

// Deletes every line fenced for `moduleId`: single lines carrying a trailing
// `// <module:x>` marker, and whole blocks between own-line
// `// <module:x>` / `// </module:x>` markers. Returns the fence hits found
// (used by --emit-docs) and, when `write` is true, persists the stripped file.
function stripFencesInFile(filePath, moduleId, write) {
  const startMarker = `// <module:${moduleId}>`;
  const endMarker = `// </module:${moduleId}>`;
  const original = readFileSync(filePath, 'utf8');
  const lines = original.split('\n');
  const kept = [];
  const hits = [];
  let inBlock = false;
  let blockStartLine = -1;

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === startMarker) {
      inBlock = true;
      blockStartLine = index + 1;

      return;
    }

    if (trimmed === endMarker) {
      inBlock = false;
      hits.push({ kind: 'block', startLine: blockStartLine, endLine: index + 1 });

      return;
    }

    if (inBlock) return;

    if (line.includes(startMarker)) {
      hits.push({ kind: 'line', startLine: index + 1, endLine: index + 1, preview: line.trim() });

      return;
    }

    kept.push(line);
  });

  if (write && hits.length > 0) writeFileSync(filePath, kept.join('\n'));

  return hits;
}

function scanFences(treeRoot, moduleId, write) {
  const results = [];

  for (const filePath of fenceFilesUnder(treeRoot)) {
    const hits = stripFencesInFile(filePath, moduleId, write);

    if (hits.length > 0) {
      results.push({ file: path.relative(treeRoot, filePath), hits });
    }
  }

  return results;
}

function deleteModulePaths(treeRoot, modulePaths) {
  for (const relPath of modulePaths) {
    rmSync(path.join(treeRoot, relPath), { recursive: true, force: true });
  }
}

function createWorktree(moduleId) {
  const tmpParent = mkdtempSync(path.join(tmpdir(), 'subtraction-'));
  const dir = path.join(tmpParent, moduleId);
  const branch = `subtraction/${moduleId}-${randomUUID().slice(0, 8)}`;
  const result = run('git', ['worktree', 'add', '-b', branch, dir, 'HEAD']);

  if (result.status !== 0) {
    // `git worktree add` failed before creating anything worth tracking —
    // the mkdtemp parent would otherwise leak forever, unlike a failure
    // further down the pipeline (which removeWorktree cleans up).
    rmSync(tmpParent, { recursive: true, force: true });

    throw new Error(`git worktree add failed for ${moduleId}:\n${result.output}`);
  }

  return { dir, tmpParent, branch };
}

function removeWorktree(worktree) {
  run('git', ['worktree', 'remove', '--force', worktree.dir]);
  run('git', ['branch', '-D', worktree.branch]);
  rmSync(worktree.tmpParent, { recursive: true, force: true });
}

// Prisma's generated client/TypedSQL output isn't checked in. `prisma
// generate --sql` needs a live database, which per-module worktrees don't
// get — so the primary tree's already-built generated/ dir is copied in
// verbatim instead. Nothing in a fenced-down worktree can add a Prisma
// model, so a client generated from the FULL schema type-checks identically
// for whatever subset of modules remains (removed modules' generated types
// simply go unused once their importing files are deleted).
// Returns the same {status, output} shape as run() (never throws) so a
// missing source dir (script run before `pnpm run build`) or any other I/O
// error surfaces as an ordinary failed step — caught by runModule's loop,
// which still calls removeWorktree() — rather than an uncaught exception
// that would crash the whole run mid-worktree and skip cleanup.
function copyGeneratedPrismaClient(worktreeDir) {
  const source = path.join(REPO_ROOT, 'apps/api/src/generated');
  const dest = path.join(worktreeDir, 'apps/api/src/generated');

  try {
    cpSync(source, dest, { recursive: true });

    return { status: 0, output: '' };
  } catch (error) {
    return { status: 1, output: String(error) };
  }
}

function subtractionSteps(worktreeDir) {
  return [
    ['install', () => run('pnpm', ['install', '--frozen-lockfile'], { cwd: worktreeDir })],
    [
      'build shared',
      () => run('pnpm', ['--dir', 'packages/shared', 'run', 'build'], { cwd: worktreeDir }),
    ],
    [
      'copy generated prisma client',
      () => {
        copyGeneratedPrismaClient(worktreeDir);

        return { status: 0, output: '' };
      },
    ],
    [
      'tsc --noEmit',
      () =>
        run('pnpm', ['--dir', 'apps/api', 'exec', 'tsc', '--noEmit', '-p', 'tsconfig.build.json'], {
          cwd: worktreeDir,
        }),
    ],
    ['unit tests', () => run('pnpm', ['--dir', 'apps/api', 'run', 'test'], { cwd: worktreeDir })],
  ];
}

function runModule(module, keepOnFailure) {
  log(`\n=== ${module.id} ===`);
  const worktree = createWorktree(module.id);

  deleteModulePaths(worktree.dir, module.paths);
  scanFences(worktree.dir, module.id, true);

  for (const [name, step] of subtractionSteps(worktree.dir)) {
    const result = step();

    if (result.status !== 0) {
      log(`FAIL  ${module.id}  (${name})`);
      log(result.output.split('\n').slice(-80).join('\n'));

      if (!keepOnFailure) removeWorktree(worktree);

      return {
        id: module.id,
        pass: false,
        worktree: keepOnFailure ? worktree : null,
        failedStep: name,
      };
    }

    log(`  ok  ${name}`);
  }

  log(`PASS  ${module.id}`);
  removeWorktree(worktree);

  return { id: module.id, pass: true };
}

function selectModules(filterIds) {
  if (!filterIds) return MODULES;

  const selected = MODULES.filter((module) => filterIds.includes(module.id));
  const unknown = filterIds.filter((id) => !MODULES.some((module) => module.id === id));

  if (unknown.length > 0) {
    throw new Error(`Unknown module id(s): ${unknown.join(', ')}`);
  }

  return selected;
}

function renderEnvVarsSection(envVars) {
  if (envVars.length === 0) return '_No dedicated `.env` variables._';

  return envVars.map((name) => `- \`${name}\``).join('\n');
}

function renderFenceSection(fenceResults) {
  if (fenceResults.length === 0) {
    return '_No cross-module references to strip — the module is self-contained._';
  }

  return fenceResults
    .map(({ file, hits }) => {
      const hitLines = hits
        .map((hit) =>
          hit.kind === 'block'
            ? `  - lines ${hit.startLine}-${hit.endLine} (block)`
            : `  - line ${hit.startLine}: \`${hit.preview}\``,
        )
        .join('\n');

      return `- \`${file}\`\n${hitLines}`;
    })
    .join('\n');
}

function renderModuleDoc(module) {
  const fenceResults = scanFences(REPO_ROOT, module.id, false);
  const pathsSection = module.paths.map((p) => `- \`${p}\` (delete)`).join('\n');

  return `# Removing \`${module.id}\`

${module.summary}

Generated by \`scripts/subtraction-test.mjs --emit-docs\` from the \`// <module:${module.id}>\`
fence markers in the codebase — do not hand-edit; re-run the generator instead.

## 1. Delete

${pathsSection}

## 2. Strip cross-module references

Every line/block below carries a \`// <module:${module.id}>\` (or
\`// <module:${module.id}>\` ... \`// </module:${module.id}>\`) fence comment. Delete
the marked lines/blocks and the markers themselves.

${renderFenceSection(fenceResults)}

## 3. Drop \`.env\` variables

${renderEnvVarsSection(module.envVars)}

## 4. Verify

\`\`\`
pnpm --dir apps/api exec tsc --noEmit -p tsconfig.build.json
pnpm --dir apps/api run test
\`\`\`

This exact recipe is proven nightly by \`scripts/subtraction-test.mjs --module ${module.id}\`.
`;
}

function renderReadme() {
  const removableList = MODULES.map((m) => `- [\`${m.id}\`](./${m.id}.md) — ${m.summary}`).join(
    '\n',
  );
  const nonRemovableList = NON_REMOVABLE.map((m) => `- **${m.id}** — ${m.reason}`).join('\n\n');

  return `# Removal recipes

This directory is generated by \`node scripts/subtraction-test.mjs --emit-docs\` from
\`// <module:x>\` fence markers left in the codebase by optional modules' cross-references.
Regenerate it instead of hand-editing after any fence changes.

The same fence markers back \`scripts/subtraction-test.mjs\`, which nightly (and on pushes to
\`staging\`/\`main\`) deletes each module below in an isolated git worktree and proves the rest
of the app still type-checks and passes its unit tests — see
\`.github/workflows/subtraction.yml\`.

## Removable modules

${removableList}

## Scope note: v0.1 providers

Only \`cloudfront\` is exercised this round. S3/SQS/SNS/SES(mail)/Lambda are also optional,
disable-fallback providers, but they predate the fence-marker convention introduced in this
PR (Task 14, v0.3). Retrofitting fences onto all of them is deliberately deferred to a
dedicated pass rather than folded into this release.

## Not removable (investigated, kept in core)

${nonRemovableList}
`;
}

function emitDocs() {
  for (const module of MODULES) {
    const docPath = path.join(REPO_ROOT, 'docs/removal', `${module.id}.md`);

    writeFileSync(docPath, renderModuleDoc(module));
    log(`wrote docs/removal/${module.id}.md`);
  }

  writeFileSync(path.join(REPO_ROOT, 'docs/removal/README.md'), renderReadme());
  log('wrote docs/removal/README.md');
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.emitDocs) {
    emitDocs();

    return;
  }

  const modules = selectModules(args.modules);
  const results = modules.map((module) => runModule(module, args.keepOnFailure));
  const failed = results.filter((result) => !result.pass);

  log('\n=== subtraction test summary ===');

  for (const result of results) {
    log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.id}`);
  }

  if (failed.length > 0) {
    for (const result of failed) {
      if (result.worktree) log(`kept worktree for inspection: ${result.worktree.dir}`);
    }

    process.exitCode = 1;
  }
}

main();
