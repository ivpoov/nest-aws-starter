// The map between the repository's markdown files and the pages of this site.
//
// Nothing under `docs/` is copied into this workspace. This module is the only
// place that knows where the prose lives, and three consumers read it: the
// content loader (which pages exist), the remark plugin (where a relative
// `./foo.md` link should point once rendered), and the sidebar (how the pages
// are grouped). Add a file to `docs/` and it appears on the site with no edit
// here; delete one and it disappears. That is the whole point — a docs site
// that keeps its own copy of the prose is a docs site that goes stale.

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the repository root, from apps/docs/src/repo-docs/. */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Where the site is published and where the sources it renders can be read.
 * `base` is a GitHub Pages project path: the site lives under the repository
 * name, not at the domain root, so every link this module hands out is
 * base-prefixed.
 */
export const SITE = {
  origin: 'https://ivpoov.github.io',
  base: '/nest-aws-starter',
  repo: 'https://github.com/ivpoov/nest-aws-starter',
  branch: 'main',
};

/** Repository files that become top-level pages, in sidebar order. */
const ROOT_PAGES = [
  ['README.md', 'index'],
  ['CONTRIBUTING.md', 'contributing'],
  ['SECURITY.md', 'security'],
];

/** The directory whose tree is mirrored onto the site one-for-one. */
const DOCS_DIR = 'docs';

/**
 * Pages that exist only on the site: section landing pages for directories the
 * repository has no README for. They hold navigation, never prose — anything
 * worth saying about the code belongs in `docs/`, where a reader who cloned the
 * repository can find it.
 */
const LOCAL_DIR = 'apps/docs/src/pages-content';

function walkMarkdown(absoluteDir, repoDir, found) {
  let entries;
  try {
    entries = readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    // A directory that does not exist yet contributes no pages rather than
    // failing the build. `docs/guides/deployment.md`, for one, is written
    // after the first real terraform apply.
    return found;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(absoluteDir, entry.name);
    const repoPath = `${repoDir}/${entry.name}`;
    if (entry.isDirectory()) {
      walkMarkdown(absolute, repoPath, found);
    } else if (entry.name.endsWith('.md')) {
      found.push(repoPath);
    }
  }
  return found;
}

/** `docs/decisions/README.md` -> `decisions`; `docs/architecture.md` -> `architecture`. */
function docsPathToId(repoPath) {
  const withoutExtension = repoPath.slice(`${DOCS_DIR}/`.length, -'.md'.length);
  if (withoutExtension === 'README') return 'index';
  return withoutExtension.endsWith('/README')
    ? withoutExtension.slice(0, -'/README'.length)
    : withoutExtension;
}

/**
 * Every page of the site, as `{ id, repoPath }`, read from disk on each call.
 * `id` is the Starlight route id: `index` is the home page, everything else is
 * its path under `docs/`.
 */
export function collectPages() {
  const pages = [];
  for (const [repoPath, id] of ROOT_PAGES) {
    pages.push({ id, repoPath });
  }
  for (const repoPath of walkMarkdown(path.join(REPO_ROOT, DOCS_DIR), DOCS_DIR, [])) {
    pages.push({ id: docsPathToId(repoPath), repoPath });
  }
  for (const repoPath of walkMarkdown(path.join(REPO_ROOT, LOCAL_DIR), LOCAL_DIR, [])) {
    pages.push({ id: path.basename(repoPath, '.md'), repoPath });
  }
  return pages;
}

/** Repository-relative path -> route id, including directories with a README. */
export function pageIndex() {
  const byRepoPath = new Map();
  for (const { id, repoPath } of collectPages()) {
    byRepoPath.set(repoPath, id);
    if (repoPath.endsWith('/README.md')) {
      byRepoPath.set(path.posix.dirname(repoPath), id);
    }
  }
  return byRepoPath;
}

/** The href of a page, base-prefixed and with the trailing slash Astro builds. */
export function hrefForId(id) {
  return id === 'index' ? `${SITE.base}/` : `${SITE.base}/${id}/`;
}

/** The href of a repository file that is not a page — the source on GitHub. */
export function hrefOnGitHub(repoPath, isDirectory) {
  const kind = isDirectory ? 'tree' : 'blob';
  return `${SITE.repo}/${kind}/${SITE.branch}/${repoPath}`;
}
