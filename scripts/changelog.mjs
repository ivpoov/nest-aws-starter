#!/usr/bin/env node

/**
 * Generates CHANGELOG.md, release notes and promotion pull-request bodies from
 * the git history. No dependencies — node builtins and `git`, nothing else — so
 * it runs on a bare runner before `pnpm install` and on a laptop with a cold
 * node_modules.
 *
 * WHY THIS EXISTS: promotion and tagging were forgotten in three consecutive
 * releases because both depended on somebody remembering. Anything a release
 * needs has to be derivable from the repository, and the changelog is the part
 * that used to be written by hand and therefore never was.
 *
 * WHAT IT ASSUMES ABOUT THE HISTORY — and these are load-bearing:
 *
 *   1. Commit subjects are conventional and SUBJECT LINE ONLY. There are no
 *      bodies and no trailers anywhere in this repository, so there is nothing
 *      to parse past the first line and, in particular, no `BREAKING CHANGE:`
 *      footer to look for. The only breaking-change signal available is the `!`
 *      marker in `feat(api)!: …`, so that is the only one implemented.
 *
 *   2. Scopes are used heavily (`feat(api):`, `fix(infra):`, `test(web,admin):`)
 *      so entries are grouped by type and then clustered by scope, which is the
 *      difference between a readable section and three hundred unsorted bullets.
 *
 *   3. Promotions are merge commits titled `Merge pull request #N from …`.
 *      Those carry nothing a reader wants and would be a large slice of the
 *      file, so `--no-merges` drops every one of them. The commits they brought
 *      in are still listed: `git log --no-merges A..B` walks into both parents,
 *      it does not skip the merged branch.
 *
 * MODES
 *
 *   node scripts/changelog.mjs [--tip main]
 *       Whole history. One section per version tag reachable from the tip
 *       (HEAD by default), newest first. This is what produces the v0.1 → today
 *       file from scratch. Release tags live on main and main is never an
 *       ancestor of dev, so from a dev checkout this refuses to run rather than
 *       emitting an empty file.
 *
 *   node scripts/changelog.mjs --release v1.0.0
 *       Same, with the yet-untagged commits on top under the given version.
 *
 *   node scripts/changelog.mjs --from v0.4.0 --to v0.5.0
 *       One section for one range.
 *
 *   node scripts/changelog.mjs --from v0.5.0 --to origin/dev --notes
 *       Just the body — no `# Changelog` preamble, no version heading. This is
 *       what goes into a GitHub Release body and into a promotion PR
 *       description.
 *
 *   … --out <path>       write there instead of stdout (release workflow: CHANGELOG.md)
 *   … --repo-url <url>   base URL for commit links; defaults to the origin remote
 *   … --no-links         omit commit links entirely
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/** Order matters: this is the order sections appear under a version. */
const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Bug Fixes'],
  ['perf', 'Performance'],
  ['revert', 'Reverts'],
  ['refactor', 'Refactoring'],
  ['build', 'Build'],
  ['ci', 'CI'],
  ['test', 'Tests'],
  ['docs', 'Documentation'],
  ['style', 'Style'],
  ['chore', 'Chores'],
];

const OTHER_SECTION = 'Other';

/**
 * A conventional subject line. `scope` and the `!` breaking marker are both
 * optional; everything after the colon is the subject. Anything that does not
 * match lands in `Other` rather than being dropped — a changelog that silently
 * loses commits is worse than one with an untidy section.
 */
const CONVENTIONAL = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<breaking>!)?: (?<subject>.+)$/;

/** The tag shape this repository releases under. */
const VERSION_TAG = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** ASCII unit separator: cannot occur in a commit subject, so it is a safe field delimiter. */
const FIELD = '\u001f';

/** Sorts scope-less entries last without a second comparator branch. */
const SORT_LAST = '￿';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
}

function gitOrNull(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/**
 * Derives the https base URL for commit links from the origin remote, handling
 * both the https and the scp-style ssh form. Returns null when there is no
 * usable remote — links are a nicety, and their absence must never fail a
 * release.
 */
function repoUrlFromRemote() {
  const remote = gitOrNull(['config', '--get', 'remote.origin.url']);
  if (!remote) return null;
  const ssh = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const https = remote.match(/^https?:\/\/(?:[^@/]+@)?(.+?)(?:\.git)?$/);
  if (https) return `https://${https[1]}`;
  return null;
}

/**
 * Version tags reachable from `ref`, oldest first. `--merged` keeps a tag that
 * lives only on some abandoned branch out of the file, and `--sort=v:refname`
 * is what stops v0.10.0 from sorting before v0.9.0.
 */
function versionTags(ref) {
  const merged = ref === null ? [] : ['--merged', ref];
  const listed = git(['tag', '--list', ...merged, '--sort=v:refname']);
  if (!listed) return [];
  return listed.split('\n').filter((tag) => VERSION_TAG.test(tag));
}

/**
 * The date a section is stamped with. `creatordate` on a tag ref is the tagger
 * date for an annotated tag and the commit date for a lightweight one — v0.1.0
 * in this repository is lightweight and the rest are annotated, so reading the
 * tag object directly is the only form that is right for both. Falls back to
 * the commit date for anything that is not a tag.
 */
function refDate(ref) {
  const tagged = gitOrNull(['for-each-ref', '--format=%(creatordate:short)', `refs/tags/${ref}`]);
  if (tagged) return tagged;
  return gitOrNull(['log', '-1', '--format=%cd', '--date=short', ref]) ?? '';
}

/**
 * Parses a revision range into entries. `--reverse` gives oldest-first, which
 * is the order the work was actually done in and reads better inside a scope
 * than git's default newest-first.
 */
function entriesFor(range) {
  const raw = git(['log', '--no-merges', '--reverse', `--format=%H${FIELD}%h${FIELD}%s`, ...range]);
  if (!raw) return [];

  return raw.split('\n').map((line) => {
    const [hash, short, subject] = line.split(FIELD);
    const match = CONVENTIONAL.exec(subject);
    if (!match?.groups) {
      return { hash, short, type: null, scope: null, breaking: false, subject };
    }
    const { type, scope, breaking, subject: text } = match.groups;
    return { hash, short, type, scope: scope || null, breaking: Boolean(breaking), subject: text };
  });
}

function renderEntry(entry, repoUrl) {
  const scope = entry.scope ? `**${entry.scope}:** ` : '';
  const link = repoUrl ? ` ([\`${entry.short}\`](${repoUrl}/commit/${entry.hash}))` : '';
  return `- ${scope}${entry.subject}${link}`;
}

/**
 * Groups by type, clusters by scope inside each group, and drops exact repeats.
 * Duplicates are real here: a commit that reached a release along two paths
 * shows up twice with two hashes and one subject, and listing it twice tells
 * the reader nothing.
 */
function renderSectionBody(entries, repoUrl) {
  const lines = [];
  const seen = new Set();
  const deduped = entries.filter((entry) => {
    const key = `${entry.type}|${entry.scope}|${entry.subject}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const breaking = deduped.filter((entry) => entry.breaking);
  if (breaking.length > 0) {
    lines.push('### BREAKING CHANGES', '');
    for (const entry of breaking) lines.push(renderEntry(entry, repoUrl));
    lines.push('');
  }

  const known = new Set(SECTIONS.map(([type]) => type));
  const groups = [
    ...SECTIONS.map(([type, title]) => [title, deduped.filter((entry) => entry.type === type)]),
    [OTHER_SECTION, deduped.filter((entry) => !known.has(entry.type))],
  ];

  for (const [title, group] of groups) {
    if (group.length === 0) continue;
    const sorted = [...group].sort((a, b) =>
      (a.scope ?? SORT_LAST).localeCompare(b.scope ?? SORT_LAST),
    );
    lines.push(`### ${title}`, '');
    for (const entry of sorted) lines.push(renderEntry(entry, repoUrl));
    lines.push('');
  }

  if (lines.length === 0) lines.push('_No commits in this range._', '');
  return lines;
}

function compareLink(from, to, repoUrl) {
  if (!repoUrl || !from) return null;
  return `[\`${from}...${to}\`](${repoUrl}/compare/${from}...${to})`;
}

function renderSection({ version, date, from, to, entries, repoUrl }) {
  const lines = [date ? `## ${version} (${date})` : `## ${version}`, ''];
  const compare = compareLink(from, to, repoUrl);
  if (compare) lines.push(compare, '');
  lines.push(...renderSectionBody(entries, repoUrl));
  return lines;
}

const FILE_HEADER = [
  '# Changelog',
  '',
  'Every notable change, grouped by [conventional commit](https://www.conventionalcommits.org/)',
  'type. Promotion merge commits are omitted; the commits they carried are not.',
  '',
  '**Generated — do not edit by hand.** Regenerate with',
  '`node scripts/changelog.mjs --out CHANGELOG.md`; the release workflow does exactly that.',
  '',
];

function emit(text, out) {
  if (out === undefined) {
    process.stdout.write(text);
    return;
  }
  writeFileSync(out, text);
  process.stderr.write(`wrote ${out}\n`);
}

function main() {
  const { values } = parseArgs({
    options: {
      release: { type: 'string' },
      tip: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      notes: { type: 'boolean', default: false },
      out: { type: 'string' },
      'repo-url': { type: 'string' },
      'no-links': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    process.stdout.write(
      'usage: changelog.mjs [--release <version>] [--tip <ref>] [--from <ref>] [--to <ref>]\n' +
        '                     [--notes] [--out <path>] [--repo-url <url>] [--no-links]\n',
    );
    return;
  }

  const repoUrl = values['no-links'] ? null : (values['repo-url'] ?? repoUrlFromRemote());
  const to = values.to ?? 'HEAD';

  // Explicit range: one section, or with --notes just its body.
  if (values.from !== undefined || values.to !== undefined) {
    const from = values.from ?? null;
    const entries = entriesFor(from ? [`${from}..${to}`] : [to]);
    const body = values.notes
      ? renderSectionBody(entries, repoUrl)
      : renderSection({
          version: values.release ?? to,
          date: refDate(to),
          from,
          to,
          entries,
          repoUrl,
        });
    emit(`${body.join('\n').trimEnd()}\n`, values.out);
    return;
  }

  // Whole history: one section per tag, newest first, the unreleased range on top.
  const tip = values.tip ?? 'HEAD';
  const tags = versionTags(tip);

  // Release tags live on main, and main is never an ancestor of dev in this
  // branch model — so running this from a feature branch or from dev finds no
  // tags and would otherwise emit a cheerful, empty, wrong changelog. Fail
  // instead. (No tags anywhere is a different thing entirely: that is the first
  // release, and it proceeds.)
  if (tags.length === 0 && versionTags(null).length > 0) {
    process.stderr.write(
      `changelog: no version tag is reachable from ${tip}, but this repository has some.\n` +
        'Release tags live on main; run this with --tip main (release.yml checks main out).\n',
    );
    process.exitCode = 1;
    return;
  }

  const sections = [];

  if (values.release !== undefined) {
    const last = tags.at(-1) ?? null;
    sections.push(
      renderSection({
        version: values.release,
        date: new Date().toISOString().slice(0, 10),
        from: last,
        to: values.release,
        entries: entriesFor(last ? [`${last}..${tip}`] : [tip]),
        repoUrl,
      }),
    );
  }

  for (let index = tags.length - 1; index >= 0; index -= 1) {
    const tag = tags[index];
    const previous = index > 0 ? tags[index - 1] : null;
    sections.push(
      renderSection({
        version: tag,
        date: refDate(tag),
        from: previous,
        to: tag,
        entries: entriesFor(previous ? [`${previous}..${tag}`] : [tag]),
        repoUrl,
      }),
    );
  }

  const out = [...(values.notes ? [] : FILE_HEADER), ...sections.flat()];
  emit(`${out.join('\n').trimEnd()}\n`, values.out);
}

main();
