import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import rehypeMermaid from 'rehype-mermaid';
import starlightLinksValidator from 'starlight-links-validator';
import { rehypeDiagramFrame } from './src/repo-docs/rehype-diagram-frame.mjs';
import { remarkRepoLinks } from './src/repo-docs/remark-repo-links.mjs';
import { SITE } from './src/repo-docs/routes.mjs';
import { buildSidebar } from './src/repo-docs/sidebar.mjs';

// GitHub Pages serves a project site under the repository name, so `base` is
// not `/`. Every URL this workspace generates goes through routes.mjs, which
// prefixes it — nothing here hard-codes the path a second time.
export default defineConfig({
  site: SITE.origin,
  base: SITE.base,
  markdown: {
    // Astro 7 defaults to the satteri processor; this picks the remark/rehype
    // one back up on purpose, because the link rewriter below is an ordinary
    // mdast plugin and Starlight appends its own plugins to whichever processor
    // is configured. Passing plugins through the deprecated
    // `markdown.remarkPlugins` would do the same thing and warn about it.
    processor: unified({
      remarkPlugins: [remarkRepoLinks],
      // The ```mermaid blocks in docs/architecture.md become SVG here, at build
      // time, so the published page ships a diagram and not a megabyte of
      // diagram renderer. Mermaid needs a real browser to measure text, which
      // is why playwright is a dependency of this workspace — `channel:
      // 'chrome'` uses the Chrome that is already installed rather than
      // downloading a second one (GitHub's ubuntu runners ship it, which is why
      // the workflow does not install browsers either).
      rehypePlugins: [
        [
          rehypeMermaid,
          {
            strategy: 'inline-svg',
            launchOptions: { channel: 'chrome' },
            mermaidConfig: { theme: 'neutral' },
          },
        ],
        rehypeDiagramFrame,
      ],
    }),
  },
  integrations: [
    starlight({
      title: 'nest-aws-starter',
      description:
        'A NestJS + React monorepo with auth, payments, notifications and an admin console, already built, tested and wired to AWS.',
      social: [{ icon: 'github', label: 'GitHub', href: SITE.repo }],
      // Every page is a real file in the repository, so "Edit page" goes to the
      // source rather than to a generated copy of it.
      editLink: { baseUrl: `${SITE.repo}/edit/${SITE.branch}/` },
      sidebar: buildSidebar(),
      customCss: ['./src/styles/diagrams.css'],
      // Fails the build on an internal link that resolves to nothing. The prose
      // is written for GitHub and rewritten for the web on the way through
      // (see remark-repo-links.mjs); this is what proves the rewrite worked.
      plugins: [
        starlightLinksValidator({
          // Relative links are not an error here: anything that resolves to a
          // file in the repository has already been turned into an absolute
          // URL, so what is left is intentional.
          errorOnRelativeLinks: false,
          // The README points at http://localhost:3000/docs, which is where the
          // API's Swagger UI is when you run it. That is the correct link.
          errorOnLocalLinks: false,
        }),
      ],
      pagination: false,
    }),
  ],
});
