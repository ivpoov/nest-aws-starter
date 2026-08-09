#!/usr/bin/env node

/**
 * The guards that stand between a `workflow_dispatch` click and a tag that
 * cannot be taken back. Dependency-free — node builtins and `git` — so it runs
 * on a bare runner before any install, and so it can be run by hand against a
 * scratch clone to prove a guard actually fires.
 *
 * A tag is the one thing in this repository that is effectively permanent: it
 * is what the README, the release notes and anybody's `git checkout v0.5.0`
 * point at, and moving one after publication breaks every clone that already
 * fetched it. So every one of these checks is fatal, none of them is a warning,
 * and each prints the exact remedy rather than just the verdict.
 *
 * CHECKS
 *
 *   tag-absent --version vX.Y.Z
 *       The version is well formed and no such tag exists — locally OR on the
 *       remote. Both halves matter: a fresh runner has no tags until they are
 *       fetched, so a local-only check would happily "prove" that v0.5.0 is
 *       free and then fail at push time, after the changelog was already
 *       committed.
 *
 *   branches-in-sync [--branches dev,staging,main]
 *       Nothing is left unpromoted and all three branches carry identical
 *       content. NOT "the same commit SHA" — see the long comment on
 *       checkBranchesInSync for why that test would fire on every release.
 *       This is a release-time invariant, not an everyday one: mid-cycle dev
 *       is supposed to be ahead. Tagging while they differ produces a release
 *       whose contents nobody can name.
 *
 *   main-tagged [--branch main]
 *       Every commit on main is covered by a version tag, i.e. the newest tag
 *       reachable from main IS main's tip. This is the one that runs
 *       unattended on every push to main: if promotion happened and tagging
 *       did not — the failure mode that has now happened three releases
 *       running — this check is red until somebody cuts the tag.
 *
 *   preflight --version vX.Y.Z
 *       tag-absent + branches-in-sync, i.e. everything that must hold before
 *       release.yml is allowed to write anything.
 *
 * OPTIONS
 *
 *   --remote <name|path>  default `origin`; a path works too, which is what
 *                         makes these checks testable against a scratch repo
 *   --verify-remote       additionally prove the remote-tracking refs are not
 *                         stale, i.e. nobody pushed between checkout and tag
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const VERSION_TAG = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const DEFAULT_BRANCHES = ['dev', 'staging', 'main'];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trimEnd();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/**
 * Read through a helper rather than as `process.env.GITHUB_ACTIONS`. Biome's
 * noUndeclaredEnvVars rule wants every statically named variable declared in
 * turbo.json — correct advice for code turbo runs and caches, and wrong here:
 * this script is invoked by a workflow step, never by a turbo task, so listing
 * runner variables in turbo.json would document a dependency that does not
 * exist.
 */
function readEnv(name) {
  return process.env[name];
}

const results = [];

function record(check, ok, message, remedy) {
  results.push({ check, ok, message, remedy });
}

/**
 * One line per check on stdout, a GitHub annotation per failure so the message
 * lands on the run summary rather than only in the log, and a table in the job
 * summary so a reader who opens a red run sees the verdict before the scroll.
 */
function report() {
  const failures = results.filter((result) => !result.ok);

  for (const result of results) {
    const verdict = result.ok ? 'PASS' : 'FAIL';
    process.stdout.write(`release-guard: ${verdict}  ${result.check}  ${result.message}\n`);
    if (!result.ok && result.remedy) {
      process.stdout.write(`release-guard:        remedy  ${result.remedy}\n`);
    }
  }

  if (readEnv('GITHUB_ACTIONS') === 'true') {
    for (const result of failures) {
      const detail = result.remedy ? `${result.message} — ${result.remedy}` : result.message;
      process.stdout.write(`::error title=release guard: ${result.check}::${detail}\n`);
    }
  }

  const summaryPath = readEnv('GITHUB_STEP_SUMMARY');
  if (summaryPath) {
    const rows = results.map(
      (result) =>
        `| ${result.ok ? 'pass' : '**FAIL**'} | \`${result.check}\` | ${result.message} |`,
    );
    appendFileSync(
      summaryPath,
      ['### Release guards', '', '| | check | detail |', '| --- | --- | --- |', ...rows, ''].join(
        '\n',
      ),
    );
  }

  process.exitCode = failures.length > 0 ? 1 : 0;
}

/**
 * Resolves a branch from the remote-tracking ref. Local, deliberately: the tree
 * comparison below needs the objects, which `ls-remote` cannot supply. Staleness
 * is covered separately by --verify-remote.
 */
function branchSha(branch, remote) {
  return gitOrNull(['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${branch}`]);
}

function remoteBranchSha(branch, remote) {
  const line = gitOrNull(['ls-remote', '--heads', remote, `refs/heads/${branch}`]);
  if (!line) return null;
  return line.split('\n')[0].split('\t')[0];
}

function checkTagAbsent(version, remote) {
  if (!version || !VERSION_TAG.test(version)) {
    record(
      'tag-absent',
      false,
      `"${version ?? ''}" is not a version tag`,
      'pass --version as vMAJOR.MINOR.PATCH, e.g. v1.0.0',
    );
    return;
  }

  const localTag = gitOrNull(['rev-parse', '--verify', '--quiet', `refs/tags/${version}^{commit}`]);
  if (localTag) {
    record(
      'tag-absent',
      false,
      `${version} already exists locally, on commit ${localTag.slice(0, 7)}`,
      'a published tag is never moved — release the next version instead',
    );
    return;
  }

  const remoteTag = gitOrNull(['ls-remote', '--tags', remote, `refs/tags/${version}`]);
  if (remoteTag) {
    record(
      'tag-absent',
      false,
      `${version} already exists on ${remote}`,
      'a published tag is never moved — release the next version instead',
    );
    return;
  }

  record('tag-absent', true, `${version} is free locally and on ${remote}`);
}

/**
 * "In sync" cannot mean "the same commit SHA" in this repository, and getting
 * that wrong would make the guard fire on every single release. Promotions are
 * pull-request merges: `dev → staging` lands a merge commit that lives only on
 * staging, and `staging → main` lands another that lives only on main. The three
 * branches are therefore NEVER equal by SHA, not even one second after a
 * perfectly executed promotion. Verified against this repository's own history:
 * at v0.5.0, main's tip and staging differed by SHA and matched exactly by tree.
 *
 * So sync is checked on the two things that are actually true when a promotion
 * has completed:
 *
 *   1. NOTHING UNPROMOTED — `main..dev` and `main..staging` are both empty. Any
 *      commit still sitting on dev is work the tag would silently exclude.
 *
 *   2. IDENTICAL CONTENT — all three tips resolve to the same tree object. This
 *      is what catches the case (1) cannot see: a hotfix committed straight to
 *      main and never merged back down. Same content, three branches, one
 *      answer to "what is in this release".
 */
function checkBranchesInSync(branches, remote, verifyRemote) {
  const heads = branches.map((branch) => ({ branch, sha: branchSha(branch, remote) }));
  const missing = heads.filter((head) => head.sha === null);
  if (missing.length > 0) {
    record(
      'branches-in-sync',
      false,
      `cannot resolve ${missing.map((head) => `${remote}/${head.branch}`).join(', ')}`,
      'check out with fetch-depth: 0 so every branch is fetched, not just the triggering ref',
    );
    return;
  }

  // main is the last link in dev → staging → main and the branch tags live on.
  const target = heads.at(-1);
  const unpromoted = heads.slice(0, -1).map((head) => ({
    branch: head.branch,
    ahead: gitOrNull(['rev-list', '--count', `${target.sha}..${head.sha}`]) ?? '?',
  }));
  const pending = unpromoted.filter((entry) => entry.ahead !== '0');

  if (pending.length > 0) {
    record(
      'branches-in-sync',
      false,
      `${pending
        .map((entry) => `${entry.branch} has ${entry.ahead} commits not on ${target.branch}`)
        .join('; ')}`,
      'run the promote workflow and merge both promotion pull requests before releasing',
    );
    return;
  }

  const trees = heads.map((head) => ({
    branch: head.branch,
    tree: gitOrNull(['rev-parse', `${head.sha}^{tree}`]),
  }));
  const distinctTrees = new Set(trees.map((entry) => entry.tree));
  if (distinctTrees.size !== 1) {
    record(
      'branches-in-sync',
      false,
      `trees differ: ${trees.map((entry) => `${entry.branch}=${entry.tree?.slice(0, 7)}`).join(', ')}`,
      `something was committed to ${target.branch} without going back down — merge ${target.branch} into dev and re-promote`,
    );
    return;
  }

  if (verifyRemote) {
    const stale = heads.filter((head) => remoteBranchSha(head.branch, remote) !== head.sha);
    if (stale.length > 0) {
      record(
        'branches-in-sync',
        false,
        `${stale.map((head) => head.branch).join(', ')} moved on ${remote} since this run checked out`,
        're-run the workflow so the release describes what is actually on the branches',
      );
      return;
    }
  }

  record(
    'branches-in-sync',
    true,
    `${branches.join(', ')} carry identical trees (${trees[0].tree.slice(0, 7)}) with nothing unpromoted`,
  );
}

function checkMainTagged(branch) {
  const head = gitOrNull(['rev-parse', '--verify', branch]);
  if (!head) {
    record(
      'main-tagged',
      false,
      `cannot resolve ${branch}`,
      'check out the branch with its history',
    );
    return;
  }

  const latest = gitOrNull(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', branch]);
  if (!latest) {
    record(
      'main-tagged',
      false,
      `no version tag is reachable from ${branch}`,
      'cut the first release with the release workflow',
    );
    return;
  }

  const behind = gitOrNull(['rev-list', '--count', `${latest}..${branch}`]);
  if (behind === '0') {
    record('main-tagged', true, `${branch} is exactly ${latest}`);
    return;
  }

  const subjects = gitOrNull(['log', '--no-merges', '--format=%s', '-3', `${latest}..${branch}`]);
  const preview = subjects ? ` e.g. ${subjects.split('\n').join(' | ')}` : '';
  record(
    'main-tagged',
    false,
    `${branch} carries ${behind} commit${behind === '1' ? '' : 's'} past ${latest} that no tag covers —${preview}`,
    'run the release workflow to tag and publish; promotion without tagging is the bug this catches',
  );
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      version: { type: 'string' },
      branches: { type: 'string', default: DEFAULT_BRANCHES.join(',') },
      branch: { type: 'string', default: 'main' },
      remote: { type: 'string', default: 'origin' },
      'verify-remote': { type: 'boolean', default: false },
    },
  });

  const check = positionals[0];
  const branches = values.branches
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  switch (check) {
    case 'tag-absent':
      checkTagAbsent(values.version, values.remote);
      break;
    case 'branches-in-sync':
      checkBranchesInSync(branches, values.remote, values['verify-remote']);
      break;
    case 'main-tagged':
      checkMainTagged(values.branch);
      break;
    case 'preflight':
      checkTagAbsent(values.version, values.remote);
      checkBranchesInSync(branches, values.remote, values['verify-remote']);
      break;
    default:
      process.stderr.write(
        'usage: release-guard.mjs <tag-absent|branches-in-sync|main-tagged|preflight>\n' +
          '                        [--version vX.Y.Z] [--branches dev,staging,main]\n' +
          '                        [--branch main] [--remote origin] [--verify-remote]\n',
      );
      process.exitCode = 2;
      return;
  }

  report();
}

main();
