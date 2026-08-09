import { defineCollection } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';
import { repoDocsLoader } from './repo-docs/loader.mjs';

// One collection, loaded straight out of the repository. There is no
// src/content/docs/ directory in this workspace, and there must never be one:
// the day prose can live in two places is the day the two disagree.
export const collections = {
  docs: defineCollection({ loader: repoDocsLoader(), schema: docsSchema() }),
};
