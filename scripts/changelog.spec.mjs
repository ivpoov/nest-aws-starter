// Unit tests for the section builder in changelog.mjs. Run with
// `node --test scripts/changelog.spec.mjs` (wired into the root `test:scripts`
// script); node:test keeps this dependency-free, which matters because
// scripts/ is deliberately outside every workspace.
//
// Each test builds a throwaway repository with real commits and real tags,
// because every interesting behaviour here is a question about git history and
// a fixture that fakes the history proves nothing about the parsing.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'changelog.mjs');

let repo = '';

function run(args, cwd = repo) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd();
}

function commit(subject) {
  writeFileSync(path.join(repo, 'file.txt'), `${subject}\n`);
  run(['add', '.']);
  run(['commit', '-m', subject]);
}

function changelog(args) {
  return execFileSync('node', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });
}

function versionHeadings(output) {
  return [...output.matchAll(/^## (v\d+\.\d+\.\d+)/gm)].map((match) => match[1]);
}

describe('changelog.mjs', () => {
  before(() => {
    repo = mkdtempSync(path.join(tmpdir(), 'changelog-spec-'));
    run(['init', '--initial-branch=main']);
    run(['config', 'user.email', 'spec@example.com']);
    run(['config', 'user.name', 'Spec']);
    run(['remote', 'add', 'origin', 'https://github.com/example/example.git']);

    commit('feat(api): the first thing');
    run(['tag', '-a', 'v1.0.0', '-m', 'v1.0.0']);
    commit('fix(api): the second thing');
    run(['tag', '-a', 'v1.1.0', '-m', 'v1.1.0']);
    commit('fix(web): something not yet released');
  });

  after(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  test('renders one section per tag, newest first', () => {
    const headings = versionHeadings(changelog(['--tip', 'main']));

    assert.deepEqual(headings, ['v1.1.0', 'v1.0.0']);
  });

  // The release flow writes the changelog BEFORE the tag exists, so the version
  // being cut has to come from the unreleased range.
  test('adds a section for a release that is not tagged yet', () => {
    const headings = versionHeadings(changelog(['--release', 'v1.2.0', '--tip', 'main']));

    assert.deepEqual(headings, ['v1.2.0', 'v1.1.0', 'v1.0.0']);
    assert.match(changelog(['--release', 'v1.2.0', '--tip', 'main']), /something not yet released/);
  });

  // Regression: re-running for a version that HAS been tagged used to emit it
  // twice — once from the unreleased range, which by then is empty, and once
  // from the tag loop. The empty one came first, so the real section was buried
  // under a `v1.1.0...v1.1.0` heading claiming no commits.
  test('does not duplicate a release that is already tagged', () => {
    const output = changelog(['--release', 'v1.1.0', '--tip', 'main']);
    const headings = versionHeadings(output);

    assert.deepEqual(headings, ['v1.1.0', 'v1.0.0']);
    assert.doesNotMatch(output, /v1\.1\.0\.\.\.v1\.1\.0/);
    assert.match(output, /the second thing/);
  });
});
