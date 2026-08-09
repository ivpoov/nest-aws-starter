// Rewrites the links in the repository's markdown so they still work once the
// markdown is a web page.
//
// `docs/**` is written for GitHub first: links are relative file paths
// (`./conventions/backend.md`, `../scripts/benchmark.mjs`, `LICENSE`), which is
// exactly right when a reader is browsing the repository and exactly wrong when
// the same file is served at `/architecture/`. Copying the prose and fixing the
// links by hand is how docs sites start lying. So the links are rewritten while
// the markdown is being rendered, from the same route table the pages are built
// from:
//
//   - a target that is a page on this site  -> that page's URL
//   - a screenshot under `docs/assets/`     -> the copy this site publishes
//   - any other file that exists in the repo -> its source on GitHub
//   - anything else                          -> left alone, and warned about
//
// The last case is deliberate: a link this plugin cannot place is a link that
// is probably broken, and starlight-links-validator fails the build on it
// rather than shipping a 404.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { hrefForId, hrefOnGitHub, pageIndex, REPO_ROOT, SITE } from './routes.mjs';

const ASSETS_PREFIX = 'docs/assets/';
const HTML_ATTRIBUTE = /\b(src|href)="([^"]+)"/g;
const ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

function repoRelative(filePath) {
  if (!filePath) return undefined;
  const relative = path.relative(REPO_ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  const posix = relative.split(path.sep).join('/');
  return posix.startsWith('node_modules/') || posix.includes('/node_modules/') ? undefined : posix;
}

/**
 * @param {Map<string, string>} pages repository path -> route id
 * @param {string} from repository path of the file the link is written in
 * @param {string} target the link target as written
 * @returns {string | undefined} the rewritten target, or undefined to leave it
 */
function rewrite(pages, from, target) {
  if (!target || target.startsWith('#') || ABSOLUTE_URL.test(target)) return undefined;

  const hashAt = target.indexOf('#');
  const hash = hashAt === -1 ? '' : target.slice(hashAt);
  const rawPath = hashAt === -1 ? target : target.slice(0, hashAt);
  if (!rawPath) return undefined;

  // A leading slash means "from the repository root". Only the site's own
  // landing pages use it; every file under docs/ links relatively, because it
  // has to work on GitHub too.
  const joined = rawPath.startsWith('/')
    ? rawPath.slice(1)
    : path.posix.join(path.posix.dirname(from), rawPath);
  const resolved = path.posix.normalize(joined).replace(/\/$/, '');
  if (!resolved || resolved.startsWith('..')) return undefined;

  const id = pages.get(resolved);
  if (id !== undefined) return hrefForId(id) + hash;

  if (resolved.startsWith(ASSETS_PREFIX)) {
    return `${SITE.base}/assets/${resolved.slice(ASSETS_PREFIX.length)}${hash}`;
  }

  const absolute = path.join(REPO_ROOT, resolved);
  if (existsSync(absolute)) {
    return hrefOnGitHub(resolved, statSync(absolute).isDirectory()) + hash;
  }

  return undefined;
}

export function remarkRepoLinks() {
  const pages = pageIndex();

  return (tree, file) => {
    const from = repoRelative(file.path);
    if (!from) return;

    visit(tree, ['link', 'image', 'definition'], (node) => {
      const rewritten = rewrite(pages, from, node.url);
      if (rewritten !== undefined) node.url = rewritten;
    });

    // The README lays its screenshots out in a table with raw <img> tags, which
    // reach here as HTML nodes rather than as markdown images.
    visit(tree, ['html'], (node) => {
      node.value = node.value.replace(HTML_ATTRIBUTE, (whole, attribute, value) => {
        const rewritten = rewrite(pages, from, value);
        return rewritten === undefined ? whole : `${attribute}="${rewritten}"`;
      });
    });
  };
}
