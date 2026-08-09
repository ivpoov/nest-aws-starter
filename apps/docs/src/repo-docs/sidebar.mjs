// The sidebar, derived from whatever markdown the repository currently has.
//
// Nothing here names an ADR or a removal recipe: both directories are
// generated or grown over time (`docs/removal/` is written by
// scripts/subtraction-test.mjs), and a hand-maintained list of them would be
// wrong within a release. Pages are picked up if they exist and silently
// skipped if they do not — which is also why `docs/guides/deployment.md`, which
// is written after the first real terraform apply, does not break this build.

import { collectPages } from './routes.mjs';

/** Guides worth reading in this order; anything else lands after them, sorted. */
const GUIDE_ORDER = ['guides/adding-a-module', 'guides/container', 'guides/production'];

export function buildSidebar() {
  const ids = new Set(collectPages().map((page) => page.id));
  const pick = (id, label) => (ids.has(id) ? [label ? { slug: id, label } : { slug: id }] : []);
  const under = (prefix) =>
    [...ids]
      .filter((id) => id.startsWith(`${prefix}/`))
      .sort()
      .map((id) => ({ slug: id }));

  const guides = [
    ...GUIDE_ORDER.flatMap((id) => pick(id)),
    ...under('guides').filter((item) => !GUIDE_ORDER.includes(item.slug)),
  ];
  const removal = [...pick('removal', 'How removal works'), ...under('removal')];
  if (removal.length > 0) {
    guides.push({ label: 'Removing a module', collapsed: true, items: removal });
  }

  const groups = [
    {
      label: 'Getting started',
      items: [
        ...pick('index', 'Overview'),
        ...pick('contributing', 'Contributing'),
        ...pick('security', 'Security policy'),
      ],
    },
    { label: 'Architecture', items: pick('architecture', 'How it fits together') },
    {
      label: 'Conventions',
      items: [...pick('conventions', 'Which document binds what'), ...under('conventions')],
    },
    { label: 'Guides', items: guides },
    {
      label: 'Decisions',
      items: [...pick('decisions', 'Why there are ADRs'), ...under('decisions')],
    },
    { label: 'Benchmarks', items: pick('benchmarks', 'Measured throughput') },
  ];

  return groups.filter((group) => group.items.length > 0);
}
