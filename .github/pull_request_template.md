## What

<!--
What this change does, and why it is needed. One or two sentences is
usually enough. Link the issue it closes, if there is one.
-->

## How to verify

<!--
The commands you actually ran, and what they reported — a reviewer should
be able to re-run them verbatim. Include manual steps when the change is
only visible in a running app.

    pnpm run build
    pnpm run lint
    pnpm run test
    pnpm run test:e2e     # needs `docker compose up -d --wait` first
-->

## Notes

<!--
Anything a reviewer would otherwise have to ask about: trade-offs, things
deliberately left out, follow-up work, breaking changes, new environment
variables, or migrations that have to be run on deploy. Write "none" if
there is nothing.
-->

---

- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (commitlint enforces this)
- [ ] Unit and e2e tests ship alongside the change
- [ ] Docs updated if behaviour, configuration or environment variables changed
