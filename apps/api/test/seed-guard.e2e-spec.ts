import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The demo seed creates an admin account whose password this repository
// publishes. Running it against a production database is the one mistake a
// stranger following the quick start can make that no amount of re-running
// undoes — so the refusal is proven here by spawning the real script, the
// way `prisma db seed` does, rather than unit-testing a flag.
//
// Deliberately spawns instead of importing: the guard is a top-level
// statement that calls process.exit(), which an in-process import would take
// the whole vitest worker down with. Nothing here imports an application
// module, so no subtraction-tested module removal has to fence this file.
const API_ROOT: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// DATABASE_URL is inherited: vitest loads apps/api/.env into process.env for
// the whole run (CI sets it directly instead — see turbo.json's test:e2e env
// allowlist), which is the same variable `prisma.config.ts` hands the script
// when a human runs `prisma db seed`.
// An `undefined` override deletes the variable rather than passing it as the
// string "undefined" — which is the whole point of the unset-NODE_ENV case:
// `prisma db seed` sets no NODE_ENV at all.
function runSeed(overrides: Record<string, string | undefined>): SpawnSyncReturns<string> {
  const env: Record<string, string | undefined> = { ...process.env, ...overrides };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
  }

  return spawnSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
    cwd: API_ROOT,
    encoding: 'utf8',
    env,
  });
}

describe('demo seed production guard (e2e)', () => {
  it('refuses to run with NODE_ENV=production', () => {
    const result: SpawnSyncReturns<string> = runSeed({ NODE_ENV: 'production' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to seed: NODE_ENV=production');
  });

  // The documented command is `prisma db seed`, and neither it nor
  // prisma.config.ts sets NODE_ENV. An allowlist guard that only rejected
  // "production" therefore waved through the single most likely way to hit a
  // real database: an operator with production credentials exported running
  // the command the README prints. Unset must refuse.
  it('refuses to run with NODE_ENV unset', () => {
    const result: SpawnSyncReturns<string> = runSeed({ NODE_ENV: undefined });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to seed: NODE_ENV=(unset)');
  });

  it('refuses to run with an unrecognised NODE_ENV', () => {
    const result: SpawnSyncReturns<string> = runSeed({ NODE_ENV: 'staging' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to seed: NODE_ENV=staging');
  });

  // NODE_ENV is a label an operator sets; DATABASE_URL is where the writes
  // actually land. A development label pointed at an RDS endpoint is exactly
  // the accident the label alone cannot catch, so the host is checked too.
  it('refuses to run against a non-local database host', () => {
    const result: SpawnSyncReturns<string> = runSeed({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres@db.production.example.com:5432/starter',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to seed: DATABASE_URL host');
    expect(result.stderr).toContain('db.production.example.com');
  });

  it('prints no credentials and writes nothing when it refuses', () => {
    const result: SpawnSyncReturns<string> = runSeed({ NODE_ENV: 'production' });
    const output: string = `${result.stdout}${result.stderr}`;

    expect(output).not.toContain('admin@example.com');
    expect(output).not.toContain('Demo accounts');
    expect(output).not.toContain('Seeded');
  });

  it('seeds demo accounts outside production, idempotently', () => {
    const first: SpawnSyncReturns<string> = runSeed({ NODE_ENV: 'development' });
    const second: SpawnSyncReturns<string> = runSeed({ NODE_ENV: 'development' });

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('admin@example.com');
    // Same counts on both runs — deterministic ids mean the second run
    // updates the demo rows in place instead of adding a second set.
    expect(second.stdout).toBe(first.stdout);
  });
});
