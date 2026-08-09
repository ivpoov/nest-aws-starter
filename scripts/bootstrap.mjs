#!/usr/bin/env node
// Renames a fresh clone of this starter into your own project, in one command.
//
//   pnpm bootstrap --name my-app --scope @my-app --author "Jane Doe"
//
// What it rewrites, across every file git tracks:
//   - the root package name and the `@nest-aws-starter/*` workspace scope in
//     every package.json (and every `import ... from '@nest-aws-starter/shared'`)
//   - the compose project name, which is what names the containers, the
//     volumes and the network
//   - the Postgres database name, everywhere it is spelled out (compose,
//     .env.example, the dev-defaults guard, CI workflows, Terraform, the docs)
//   - the local-infra fixture names: the MinIO bucket and user, the two SQS
//     queues, the SNS topic and the example Lambda — in the init scripts that
//     create them and in every spec, preflight check and env file that names
//     them
//   - the README title, the Swagger title, the gitleaks config title, the
//     Terraform project_name, the Docker image tag
//   - the absolute github.com URLs in SECURITY.md and the issue templates,
//     and the review owner in .github/CODEOWNERS (see the --repo note below)
//   - the LICENSE copyright line, when --author is given
// then regenerates pnpm-lock.yaml.
//
// Flags:
//   --name <kebab-name>     required. The new project name.
//   --scope <@scope>        workspace scope. Defaults to @<name>.
//   --author "<name>"       LICENSE copyright holder + root package.json author.
//   --repo <owner/repo>     GitHub owner/repo for the absolute URLs. Defaults
//                           to this clone's `origin` remote; see below.
//   --db <name>             Postgres database name. Defaults to <name> with
//                           dashes turned into underscores.
//   --drop-demo             also delete the `note` demo module and this script.
//   --dry-run               report what would change; write nothing.
//   --skip-install          skip the closing `pnpm install`.
//   --force                 proceed even if the git working tree is dirty.
//
// Why --repo exists: GitHub issue forms do not resolve relative links, so
// .github/ISSUE_TEMPLATE/config.yml and bug_report.yml must carry absolute
// URLs. Left alone, a fork's "report a security vulnerability" link points at
// the upstream repository's SECURITY.md — the wrong inbox, silently. There is
// no relative form that fixes it, so the URLs are rewritten instead, from a
// single owner/repo value.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deleteModulePaths, MODULES, scanFences, stripFencesInFile } from './subtraction-test.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// What the starter currently calls itself. Every rewrite below is a
// replacement of one of these literals, so the script is a no-op on a repo
// that has already been bootstrapped.
const CURRENT = {
  name: 'nest-aws-starter',
  scope: '@nest-aws-starter',
  owner: 'ivpoov',
  repo: 'ivpoov/nest-aws-starter',
  database: 'starter',
  // The local-infra fixtures are all named after the project too: a MinIO
  // bucket and user, two SQS queues, an SNS topic and a Lambda function. They
  // are created by docker/localstack/init-aws.sh and the compose minio-init
  // job, and named again in .env.example, the e2e specs, the e2e preflight
  // check and CI. They move as one set or not at all.
  bucket: 'starter',
  resourcePrefix: 'starter',
  copyright: 'Copyright (c) 2026 Igor Popov',
};

// The demo module `--drop-demo` removes. It is an ordinary entry in
// scripts/subtraction-test.mjs's MODULES, which means the deletion this script
// performs is the exact deletion that script proves in CI every night.
const DEMO_MODULE_ID = 'note';

// Rewritten from this script's own source would corrupt the literals in
// CURRENT above, so it is skipped; the lockfile is regenerated rather than
// patched. Everything else git tracks is fair game.
const SKIP_FILES = new Set(['scripts/bootstrap.mjs', 'pnpm-lock.yaml']);

function log(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`bootstrap: ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    ...options,
  });

  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function parseArgs(argv) {
  const args = {
    name: null,
    scope: null,
    author: null,
    repo: null,
    database: null,
    dropDemo: false,
    dryRun: false,
    skipInstall: false,
    force: false,
  };
  const withValue = {
    '--name': 'name',
    '--scope': 'scope',
    '--author': 'author',
    '--repo': 'repo',
    '--db': 'database',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];

    if (withValue[flag]) {
      const value = argv[i + 1];

      if (value === undefined || value.startsWith('--')) fail(`${flag} needs a value`);

      args[withValue[flag]] = value;
      i += 1;
      continue;
    }

    if (flag === '--drop-demo') args.dropDemo = true;
    else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--skip-install') args.skipInstall = true;
    else if (flag === '--force') args.force = true;
    else fail(`unknown flag ${flag}`);
  }

  return args;
}

// npm package names and Docker/compose project names overlap on lowercase
// kebab-case, and the value also becomes a Postgres database name by default,
// so the strictest of the three wins.
function validate(args) {
  if (!args.name) fail('--name is required, e.g. --name my-app');

  if (!/^[a-z0-9][a-z0-9-]*$/.test(args.name)) {
    fail(`--name must be lowercase kebab-case (got "${args.name}")`);
  }

  const scope = args.scope ?? `@${args.name}`;

  if (!/^@[a-z0-9][a-z0-9-._]*$/.test(scope)) {
    fail(`--scope must be an npm scope starting with @ (got "${scope}")`);
  }

  // Dashes are legal in a Postgres database name but not in Terraform's
  // `database_name` validation (infra/terraform), so the default converts them
  // rather than producing a name that only works in half the stack.
  const database = args.database ?? args.name.replace(/-/g, '_');

  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(database)) {
    fail(
      `--db must start with a letter and contain only letters, digits and _ (got "${database}")`,
    );
  }

  if (args.author?.includes('\n')) fail('--author must be a single line');

  if (args.repo && !/^[\w.-]+\/[\w.-]+$/.test(args.repo)) {
    fail(`--repo must look like owner/repo (got "${args.repo}")`);
  }

  return { ...args, scope, database };
}

// A rename is a whole-tree rewrite with no undo, so refuse to bury uncommitted
// work under it. `git status --porcelain` is empty on the fresh clone this is
// meant to be run in.
function assertCleanTree(force) {
  const status = run('git', ['status', '--porcelain']);

  if (status.status !== 0) fail('not a git repository — run this inside a clone of the starter');
  if (status.output.trim().length === 0 || force) return;

  fail(
    'the git working tree has uncommitted changes. Commit or stash them first, ' +
      'or pass --force to rewrite them in place.',
  );
}

// The issue templates need an absolute owner/repo (relative links do not
// resolve in GitHub issue forms), and the only value that is right by
// construction is the one the clone already points at. Fall back to an
// obviously-placeholder owner rather than silently leaving the upstream repo
// in a fork's security link.
function resolveRepo(explicit, name) {
  if (explicit) return { repo: explicit, source: '--repo' };

  const remote = run('git', ['remote', 'get-url', 'origin']);
  const match =
    remote.status === 0 ? remote.output.trim().match(/github\.com[:/](.+?)(?:\.git)?$/) : null;

  if (match?.[1] && match[1] !== CURRENT.repo) return { repo: match[1], source: 'origin remote' };

  return { repo: `your-org/${name}`, source: 'placeholder' };
}

// One pass, one regex: alternatives are ordered most-specific first so that
// `ivpoov/nest-aws-starter` and `@nest-aws-starter/` are consumed before the
// bare project name inside them, and nothing a replacement produces is ever
// re-scanned.
function buildReplacements(options) {
  const prefix = CURRENT.resourcePrefix;

  return [
    [CURRENT.repo, options.repo],
    // .github/CODEOWNERS assigns every review to a GitHub handle. Left alone,
    // a fork demands review from the upstream author on its own pull requests
    // — GitHub cannot satisfy that, so nothing gets approved.
    [`@${CURRENT.owner}`, `@${options.repo.split('/')[0]}`],
    [`${CURRENT.scope}/`, `${options.scope}/`],
    // Longest-first matters here and below: the bare project name is a prefix
    // of the image tag `nest-aws-starter-api:dev`, and `starter-api` is a
    // suffix of it. Whichever alternative starts earliest in the string wins,
    // so the full name always consumes it before `starter-api` can.
    [CURRENT.name, options.name],
    // The database. `starter` is also an ordinary English word in this repo's
    // prose ("this starter ships..."), so every rule below is anchored to the
    // syntax around it rather than matching the word on its own.
    [`POSTGRES_DB=${CURRENT.database}`, `POSTGRES_DB=${options.database}`],
    [`POSTGRES_DB:-${CURRENT.database}`, `POSTGRES_DB:-${options.database}`],
    [`5433/${CURRENT.database}`, `5433/${options.database}`],
    // Terraform's `database_name` default, in the root stack and the data
    // module. Its own validation rejects dashes, which is why --db defaults to
    // the project name with underscores.
    [`= "${CURRENT.database}"`, `= "${options.database}"`],
    // LocalStack and MinIO fixtures, longest name first.
    [`${prefix}-payment-webhook-queue`, `${options.name}-payment-webhook-queue`],
    [`${prefix}-api-local-secret`, `${options.name}-api-local-secret`],
    [`${prefix}-queue`, `${options.name}-queue`],
    [`${prefix}-topic`, `${options.name}-topic`],
    [`${prefix}-example`, `${options.name}-example`],
    // The mkdtemp prefix the lambda e2e spec packages its zip under. Purely
    // cosmetic, but it is one of the strings a reader greps for.
    [`${prefix}-lambda-`, `${options.name}-lambda-`],
    [`${prefix}-api`, `${options.name}-api`],
    [`S3_BUCKET_NAME=${CURRENT.bucket}`, `S3_BUCKET_NAME=${options.name}`],
    [`S3_BUCKET_NAME: ${CURRENT.bucket}`, `S3_BUCKET_NAME: ${options.name}`],
    [`local/${CURRENT.bucket}`, `local/${options.name}`],
    // The bucket name as a JS string literal: its fallback in the e2e
    // bucket helper, and the fixtures throughout the s3 config specs.
    [`'${CURRENT.bucket}'`, `'${options.name}'`],
  ];
}

function escapeForRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trackedFiles() {
  const listed = run('git', ['ls-files', '-z']);

  if (listed.status !== 0) fail('git ls-files failed — run this inside a clone of the starter');

  return listed.output
    .split('\0')
    .filter((relPath) => relPath.length > 0 && !SKIP_FILES.has(relPath));
}

// git tracks binaries too (favicons, fonts). A NUL byte in the first block is
// the same heuristic git itself uses, and it is cheaper than a MIME sniff.
function isBinary(contents) {
  return contents.slice(0, 8000).includes('\0');
}

function rewriteTrackedFiles(replacements, dryRun) {
  const lookup = new Map(replacements);
  const pattern = new RegExp(replacements.map(([from]) => escapeForRegex(from)).join('|'), 'g');
  const touched = [];
  let total = 0;

  for (const relPath of trackedFiles()) {
    const absPath = path.join(REPO_ROOT, relPath);

    if (!existsSync(absPath)) continue;

    const original = readFileSync(absPath, 'utf8');

    if (isBinary(original)) continue;

    let hits = 0;
    const rewritten = original.replace(pattern, (matched) => {
      hits += 1;

      return lookup.get(matched);
    });

    if (hits === 0) continue;

    touched.push({ relPath, hits });
    total += hits;

    if (!dryRun) writeFileSync(absPath, rewritten);
  }

  return { touched, total };
}

// The copyright holder is the one rename that is not a token swap: it is a
// specific line in a specific file, and only --author asks for it.
function rewriteLicense(author, dryRun) {
  const absPath = path.join(REPO_ROOT, 'LICENSE');

  if (!author || !existsSync(absPath)) return false;

  const original = readFileSync(absPath, 'utf8');
  const replacement = `Copyright (c) ${new Date().getFullYear()} ${author}`;

  if (!original.includes(CURRENT.copyright)) return false;
  if (!dryRun) writeFileSync(absPath, original.replace(CURRENT.copyright, replacement));

  return true;
}

// Inserted after the name line rather than through JSON.parse/stringify, which
// would reflow the whole file and fight biome's formatter.
function addRootAuthor(author, dryRun) {
  const absPath = path.join(REPO_ROOT, 'package.json');
  const original = readFileSync(absPath, 'utf8');

  if (!author || /^\s*"author":/m.test(original)) return false;

  const rewritten = original.replace(
    /^(\s*)"name": (".*"),$/m,
    `$1"name": $2,\n$1"author": ${JSON.stringify(author)},`,
  );

  if (rewritten === original) return false;
  if (!dryRun) writeFileSync(absPath, rewritten);

  return true;
}

function removeBootstrapScriptEntry(dryRun) {
  const absPath = path.join(REPO_ROOT, 'package.json');
  const original = readFileSync(absPath, 'utf8');
  const rewritten = original.replace(/^\s*"bootstrap": ".*",\n/m, '');

  if (rewritten === original) return false;
  if (!dryRun) writeFileSync(absPath, rewritten);

  return true;
}

// The whole point of routing this through subtraction-test.mjs: the demo
// removal is the same delete-paths + strip-fences pass that CI proves nightly
// against a real type-check and test run, not a second hand-written copy.
function dropDemo(dryRun) {
  const demo = MODULES.find((module) => module.id === DEMO_MODULE_ID);

  if (!demo) {
    log(`  the ${DEMO_MODULE_ID} demo module is already gone — nothing to drop`);

    return;
  }

  if (dryRun) {
    log(
      `  would delete ${demo.paths.length} path(s) and strip every <module:${DEMO_MODULE_ID}> fence`,
    );
    log('  would delete docs/removal/note.md, this script, and its package.json entry');

    return;
  }

  deleteModulePaths(REPO_ROOT, demo.paths);

  const stripped = scanFences(REPO_ROOT, DEMO_MODULE_ID, true);

  log(`  deleted ${demo.paths.length} path(s), stripped fences in ${stripped.length} file(s)`);

  // The module's own entry in MODULES sits inside a fence for exactly this
  // moment: leaving it behind would make subtraction-test.mjs fail its
  // stale-path assertion on the very next run.
  stripFencesInFile(path.join(REPO_ROOT, 'scripts/subtraction-test.mjs'), DEMO_MODULE_ID, true);
  rmSync(path.join(REPO_ROOT, `docs/removal/${DEMO_MODULE_ID}.md`), { force: true });

  const emitted = run('node', ['scripts/subtraction-test.mjs', '--emit-docs']);

  if (emitted.status !== 0) fail(`regenerating docs/removal failed:\n${emitted.output}`);

  log('  regenerated docs/removal');

  if (removeBootstrapScriptEntry(false)) log('  removed the bootstrap script from package.json');

  rmSync(path.join(REPO_ROOT, 'scripts/bootstrap.mjs'), { force: true });
  log('  removed scripts/bootstrap.mjs');
}

function main() {
  const options = validate(parseArgs(process.argv.slice(2)));
  const resolved = resolveRepo(options.repo, options.name);

  if (!options.dryRun) assertCleanTree(options.force);

  log(`bootstrap: ${CURRENT.name} -> ${options.name}`);
  log(`  scope     ${CURRENT.scope} -> ${options.scope}`);
  log(`  database  ${CURRENT.database} -> ${options.database}`);
  log(`  repo urls ${CURRENT.repo} -> ${resolved.repo}  (from ${resolved.source})`);
  if (options.author) log(`  author    ${options.author}`);
  if (options.dryRun) log('  DRY RUN — nothing will be written');

  const { touched, total } = rewriteTrackedFiles(
    buildReplacements({ ...options, repo: resolved.repo }),
    options.dryRun,
  );

  log(`\nrewrote ${total} occurrence(s) across ${touched.length} file(s)`);

  if (options.dryRun) {
    for (const { relPath, hits } of touched) log(`  ${hits}\t${relPath}`);
  }

  if (rewriteLicense(options.author, options.dryRun)) log('updated the LICENSE copyright line');
  if (addRootAuthor(options.author, options.dryRun)) log('added author to the root package.json');

  if (options.dropDemo) {
    log(`\ndropping the ${DEMO_MODULE_ID} demo module`);
    dropDemo(options.dryRun);
  }

  if (options.dryRun) return;

  if (options.skipInstall) {
    log('\nskipped pnpm install — pnpm-lock.yaml still holds the old package names');
  } else {
    log('\nregenerating pnpm-lock.yaml');

    const installed = run('pnpm', ['install'], { stdio: 'inherit' });

    if (installed.status !== 0) fail('pnpm install failed — see the output above');
  }

  log('\nDone. Still yours to do:');
  log('  - .env files are untracked, so they were not rewritten: re-copy');
  log('    apps/api/.env.example (its DATABASE_URL carries the database name)');

  if (resolved.source === 'placeholder') {
    log(`  - the github.com URLs now read ${resolved.repo}, which is a placeholder.`);
    log('    Re-run with --repo <owner/repo>, or edit SECURITY.md and');
    log('    .github/ISSUE_TEMPLATE/{config.yml,bug_report.yml} by hand.');
  }

  if (!options.dropDemo) {
    log(`  - the ${DEMO_MODULE_ID} demo module is still in the tree: re-run with --drop-demo`);
  }

  log('  - review the diff before committing: git diff');
}

main();
