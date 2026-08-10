// Smoke test for scripts/bootstrap.mjs — the README's headline "make it
// yours" command. Run with `node --test scripts/bootstrap.spec.mjs` (wired
// into the root `test:scripts` script); node:test keeps this dependency-free,
// which matters because scripts/ is deliberately outside every workspace.
//
// This file exists because nothing executed bootstrap.mjs — not a test, not a
// CI job — so a tracked symlink added later with the docs workspace
// (apps/docs/public/assets) crashed the whole run with EISDIR, in --dry-run
// mode too, and the first person to notice would have been someone cloning
// the starter. --dry-run writes nothing, so this is safe to run anywhere.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function dryRun() {
  return spawnSync(
    process.execPath,
    [
      'scripts/bootstrap.mjs',
      '--name',
      'smoke-app',
      '--scope',
      '@smoke-app',
      '--author',
      'Smoke Tester',
      '--repo',
      'smoke/smoke-app',
      '--dry-run',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
}

function changedFiles() {
  return spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout;
}

describe('bootstrap --dry-run', () => {
  it('walks every tracked file without crashing', () => {
    const result = dryRun();

    assert.equal(result.status, 0, `bootstrap exited ${result.status}:\n${result.stderr}`);
    assert.doesNotMatch(result.stderr ?? '', /EISDIR/);
  });

  it('reports a non-trivial rewrite plan and leaves the tree untouched', () => {
    // Compared before/after rather than asserted empty: the suite has to pass
    // on a developer's dirty working tree as readily as on a fresh checkout.
    const before = changedFiles();
    const result = dryRun();
    const reported = /rewrote (\d+) occurrence\(s\) across (\d+) file\(s\)/.exec(result.stdout);

    assert.ok(reported, `no rewrite summary in output:\n${result.stdout}`);
    assert.ok(Number(reported[1]) > 100, `suspiciously few occurrences: ${reported[1]}`);
    assert.ok(Number(reported[2]) > 100, `suspiciously few files: ${reported[2]}`);
    assert.equal(changedFiles(), before, '--dry-run modified tracked files');
  });
});
