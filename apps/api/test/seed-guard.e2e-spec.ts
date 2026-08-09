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
function runSeed(nodeEnv: string): SpawnSyncReturns<string> {
  return spawnSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
    cwd: API_ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: nodeEnv },
  });
}

describe('demo seed production guard (e2e)', () => {
  it('refuses to run with NODE_ENV=production', () => {
    const result: SpawnSyncReturns<string> = runSeed('production');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing to seed: NODE_ENV=production');
  });

  it('prints no credentials and writes nothing when it refuses', () => {
    const result: SpawnSyncReturns<string> = runSeed('production');
    const output: string = `${result.stdout}${result.stderr}`;

    expect(output).not.toContain('admin@example.com');
    expect(output).not.toContain('Demo accounts');
    expect(output).not.toContain('Seeded');
  });

  it('seeds demo accounts outside production, idempotently', () => {
    const first: SpawnSyncReturns<string> = runSeed('development');
    const second: SpawnSyncReturns<string> = runSeed('development');

    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('admin@example.com');
    // Same counts on both runs — deterministic ids mean the second run
    // updates the demo rows in place instead of adding a second set.
    expect(second.stdout).toBe(first.stdout);
  });
});
