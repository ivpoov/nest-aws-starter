import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { Redis } from 'ioredis';
import { Client } from 'pg';
import { resolveE2eDatabaseUrl } from './e2e-database-url.helper.js';
import { resolveE2eRedisUrl } from './e2e-redis-url.helper.js';

// E2E ISOLATION (wired as vitest `globalSetup` in vitest.e2e.config.ts,
// alongside e2e-preflight.helper.ts): owns the stores the suite runs
// against, once per run.
//
// The problem it closes: e2e specs drive the real app over HTTP, so every
// row they create is committed by the application's own connection pool.
// There is no test-owned transaction to roll back, and per-spec `afterAll`
// cleanup — the obvious alternative — had already been tried spec by spec
// and was incomplete in exactly the way hand-rolled cleanup always is (rows
// with no user to cascade from, specs that fail before their hook, specs
// that clean four of the six tables they wrote). The result was a dev
// database accumulating tens of thousands of test rows and a suite whose
// outcome depended on how many times it had been run before.
//
// Three decisions, in order of how much they matter:
//
//   1. A dedicated database (`starter` → `starter_e2e`, derived — see
//      e2e-database-url.helper.ts). The dev database is never opened by the
//      suite, so a developer's `pnpm db:seed` demo data cannot be destroyed
//      by running tests, and the dev app never shows test accounts.
//   2. Truncate before the run, not only after. An interrupted run (Ctrl-C,
//      a crashed worker, a killed CI job) leaves rows behind by definition;
//      cleaning on the way in is what makes the next run's starting state
//      identical regardless of how the last one ended.
//   3. Truncate after the run too, so the e2e database is left empty rather
//      than merely reproducible. `E2E_KEEP_DATA=true` skips this one step
//      when a failed run needs an autopsy.
//
// Safety: truncation refuses to run against any database whose name does not
// end in `_e2e`. A wrong DATABASE_URL should fail the suite, never delete a
// developer's data.
//
// Deliberately talks to Postgres and Redis through `pg`/`ioredis` directly
// and discovers its table list from the live catalog rather than importing
// PrismaService or a model list — for the same reason
// e2e-preflight.helper.ts imports nothing from the application: a subtracted
// module removes tables, and a hardcoded list would need a
// `// <module:x>` fence per model to keep scripts/subtraction-test.mjs green.
const ISOLATION_PREFIX = 'E2E ISOLATION:';
const E2E_DATABASE_NAME_SUFFIX = '_e2e';
const MAINTENANCE_DATABASE = 'postgres';
const API_ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Returns its own teardown rather than exporting a named `teardown`: the
// returned-closure form is the one vitest honours for a default-exported
// globalSetup, and it keeps the after-the-run cleanup reading from the same
// resolved URL the setup used instead of re-deriving it.
export default async function setup(): Promise<() => Promise<void>> {
  // Same call and same semantics as e2e-preflight.helper.ts's: globalSetup
  // runs before any spec boots the app, so nothing has loaded apps/api/.env
  // into this process yet, and dotenv never overrides a variable CI already
  // set.
  loadEnv();

  const databaseUrl: string = resolveE2eDatabaseUrl(requireEnv('DATABASE_URL'));

  await createDatabaseIfMissing(databaseUrl);
  migrateDatabase(databaseUrl);
  await truncateDatabase(databaseUrl);
  await flushRedis();

  console.log(
    `${ISOLATION_PREFIX} using ${describeDatabase(databaseUrl)} — created if missing, migrated ` +
      'and emptied. Your dev database and its seeded demo data are not touched by this suite.',
  );

  return (): Promise<void> => cleanUp(databaseUrl);
}

async function cleanUp(databaseUrl: string): Promise<void> {
  if (process.env.E2E_KEEP_DATA === 'true') {
    console.log(
      `${ISOLATION_PREFIX} E2E_KEEP_DATA=true — leaving this run's rows in ` +
        `${describeDatabase(databaseUrl)} for inspection. The next run empties it on the way in.`,
    );

    return;
  }

  await truncateDatabase(databaseUrl);
  await flushRedis();
}

function requireEnv(name: string): string {
  const value: string | undefined = process.env[name];

  if (!value) {
    throw new Error(
      `${ISOLATION_PREFIX} ${name} is not set. Copy apps/api/.env.example to apps/api/.env, ` +
        'or set it in the environment, before running the e2e suite.',
    );
  }

  return value;
}

// `CREATE DATABASE` cannot run inside the database it creates, so this
// connects to the cluster's maintenance database instead. Guarded by a
// catalog lookup rather than `IF NOT EXISTS` (Postgres has no such form for
// CREATE DATABASE) — the race between the two is not worth handling, since
// vitest runs this exactly once per suite run.
async function createDatabaseIfMissing(databaseUrl: string): Promise<void> {
  const name: string = databaseNameOf(databaseUrl);
  const maintenanceUrl: URL = new URL(databaseUrl);

  maintenanceUrl.pathname = `/${MAINTENANCE_DATABASE}`;

  const client: Client = new Client({ connectionString: maintenanceUrl.toString() });

  await client.connect();

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);

    if (existing.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
}

// Spawned rather than driven through an API because `prisma migrate deploy`
// has no programmatic entry point. Runs on every suite start: it is a no-op
// costing a second or so when the e2e database is already current, and it is
// what makes a brand-new `starter_e2e` usable without anyone being told to
// migrate it by hand. DATABASE_URL is passed explicitly so prisma.config.ts's
// `dotenv/config` (which never overrides) cannot point it at the dev
// database.
function migrateDatabase(databaseUrl: string): void {
  const result: SpawnSyncReturns<string> = spawnSync(
    'pnpm',
    ['exec', 'prisma', 'migrate', 'deploy'],
    { cwd: API_ROOT, encoding: 'utf8', env: { ...process.env, DATABASE_URL: databaseUrl } },
  );

  if (result.status === 0) return;

  throw new Error(
    `${ISOLATION_PREFIX} could not migrate ${describeDatabase(databaseUrl)}: ` +
      `${result.stderr || result.stdout || result.error?.message}`,
  );
}

// One statement over every table the live catalog reports, so a subtracted
// module's missing tables and a future module's new ones are both handled
// without editing this file. CASCADE covers the foreign keys between them;
// RESTART IDENTITY resets sequences so a second run's generated ids match a
// first run's. `_prisma_migrations` is excluded — dropping it would make the
// next run re-apply every migration against a schema that already has it.
async function truncateDatabase(databaseUrl: string): Promise<void> {
  assertIsE2eDatabase(databaseUrl);

  const client: Client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const tables = await client.query<{ qualified: string }>(
      "SELECT format('%I.%I', schemaname, tablename) AS qualified FROM pg_tables " +
        "WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );

    if (tables.rowCount === 0) return;

    const list: string = tables.rows.map((row) => row.qualified).join(', ');

    await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}

// The one line standing between a mistyped DATABASE_URL and a developer's
// data. Never relax it: the suffix is what proves the target is the derived
// e2e database and not something a human uses.
function assertIsE2eDatabase(databaseUrl: string): void {
  const name: string = databaseNameOf(databaseUrl);

  if (name.endsWith(E2E_DATABASE_NAME_SUFFIX)) return;

  throw new Error(
    `${ISOLATION_PREFIX} refusing to empty database "${name}" — the e2e suite only ever ` +
      `truncates a database whose name ends in "${E2E_DATABASE_NAME_SUFFIX}".`,
  );
}

// Redis holds refresh tokens, throttle counters and cached lists, none of
// which the truncate above reaches. Flushing the suite's own logical
// database (index 1 — see e2e-redis-url.helper.ts) is what stops a previous
// run's throttle counter from changing this run's result. Index 0, where the
// dev app lives, is never selected, and a cluster URL is skipped entirely
// because it has no separate database to flush.
async function flushRedis(): Promise<void> {
  const isCluster: boolean = process.env.REDIS_IS_CLUSTER === 'true';

  if (isCluster) return;

  const url: string = resolveE2eRedisUrl(process.env.REDIS_URL ?? 'redis://localhost:6390', false);
  const redis: Redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });

  try {
    await redis.connect();
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}

function databaseNameOf(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
}

function describeDatabase(databaseUrl: string): string {
  const url: URL = new URL(databaseUrl);

  return `database "${databaseNameOf(databaseUrl)}" on ${url.host}`;
}
