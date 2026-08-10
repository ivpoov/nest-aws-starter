// An Astro content loader that reads the repository's markdown where it lives.
//
// The alternative — copying `docs/**` into `src/content/docs/` at build time, or
// symlinking it — was rejected for the same reason in both cases: the copy has
// to be told about frontmatter. Starlight requires a `title` on every page, and
// none of these files have frontmatter, because they are read on GitHub too and
// GitHub would render it as a table. A loader can synthesise the frontmatter
// from the first `# Heading` instead, which keeps the requirement inside this
// workspace and leaves `docs/**` exactly as it is: plain markdown, no site
// metadata, no build system leaking into the prose.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectPages, REPO_ROOT } from './routes.mjs';

const DESCRIPTION_LIMIT = 160;
const watchersWired = new WeakSet();

/** Strips the markdown a title or a description should not carry into a meta tag. */
function plainText(markdown) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text) {
  if (text.length <= DESCRIPTION_LIMIT) return text;
  const cut = text.slice(0, DESCRIPTION_LIMIT);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`;
}

/**
 * Splits a repository document into the frontmatter Starlight needs and the
 * body it should render. The `# Heading` becomes the page title and is dropped
 * from the body, because the page template renders the title itself — leaving
 * it in would print it twice.
 */
function readDocument(raw) {
  const match = raw.match(/^\s*#[ \t]+(.+?)[ \t]*$/m);
  if (!match || match.index === undefined) {
    return { title: undefined, description: undefined, body: raw };
  }
  const body = raw.slice(0, match.index) + raw.slice(match.index + match[0].length);
  const firstParagraph = body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block.length > 0 && !block.startsWith('<') && !block.startsWith('```'));

  return {
    title: plainText(match[1]),
    description: firstParagraph ? truncate(plainText(firstParagraph)) : undefined,
    body,
  };
}

/**
 * The frontmatter the repository's markdown does not carry, handed to the
 * renderer rather than written to disk.
 *
 * `slug` is not decoration: markdown plugins that need to know which page they
 * are looking at read it from the frontmatter, and the alternative — deriving
 * the page from the file's location under `src/content/docs/` — is exactly what
 * these files do not do. starlight-links-validator is one such plugin; without
 * the slug it cannot match a link against the page it points at and reports
 * every internal link as broken. `./` is the home page: it is joined onto the
 * site's base path, and an empty string would drop the trailing slash.
 */
function frontmatter(id, title) {
  const slug = id === 'index' ? './' : id;
  return `---\ntitle: ${JSON.stringify(title)}\nslug: ${JSON.stringify(slug)}\n---\n\n`;
}

async function syncPage(context, { id, repoPath }) {
  const { store, parseData, renderMarkdown, generateDigest, logger } = context;
  const absolute = path.join(REPO_ROOT, repoPath);
  const raw = await readFile(absolute, 'utf8');
  const { title, description, body } = readDocument(raw);
  if (!title) {
    logger.warn(`${repoPath} has no level-one heading, so the page has no title — skipped.`);
    return;
  }

  const data = await parseData({ id, data: { title, description }, filePath: repoPath });
  const rendered = await renderMarkdown(frontmatter(id, title) + body, {
    fileURL: pathToFileURL(absolute),
  });

  store.set({
    id,
    data,
    body,
    // Repository-relative on purpose: Starlight appends this to the edit-link
    // base URL, so every page's "Edit page" button lands on the real source.
    filePath: repoPath,
    digest: generateDigest(raw),
    rendered,
    assetImports: rendered.metadata?.imagePaths,
  });
}

async function loadAll(context) {
  const pages = collectPages();
  context.store.clear();
  for (const page of pages) {
    await syncPage(context, page);
  }
  context.logger.info(`Rendered ${pages.length} pages from the repository's markdown.`);
}

export function repoDocsLoader() {
  return {
    name: 'repo-docs',
    load: async (context) => {
      await loadAll(context);

      const { watcher } = context;
      if (!watcher || watchersWired.has(watcher)) return;
      watchersWired.add(watcher);
      // The sources live outside srcDir, so the dev server does not watch them
      // by default. Without this, editing docs/architecture.md during
      // `pnpm --dir apps/docs run dev` would change nothing on screen.
      watcher.add([
        path.join(REPO_ROOT, 'docs'),
        path.join(REPO_ROOT, 'README.md'),
        path.join(REPO_ROOT, 'CONTRIBUTING.md'),
        path.join(REPO_ROOT, 'CODE_OF_CONDUCT.md'),
        path.join(REPO_ROOT, 'SECURITY.md'),
      ]);
      for (const event of ['add', 'change', 'unlink']) {
        watcher.on(event, (changed) => {
          if (!changed.endsWith('.md')) return;
          if (!changed.startsWith(REPO_ROOT)) return;
          loadAll(context).catch((error) => context.logger.error(String(error)));
        });
      }
    },
  };
}
