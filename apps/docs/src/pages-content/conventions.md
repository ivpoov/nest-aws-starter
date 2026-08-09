# Conventions

Three documents, and between them they bind every line of code in this
repository. They are not style guides — a pull request that disagrees with one
of them is a pull request that gets changed.

Read the one that covers the code you are about to touch, before you touch it.

- [Backend conventions](/docs/conventions/backend.md) — modules, layering,
  errors, validation, testing. Prisma never leaves a repository; services speak
  domain interfaces.
- [Frontend conventions](/docs/conventions/frontend.md) — the rules `apps/web`
  and `apps/admin` share: state, data fetching, forms, styling.
- [Shared contract conventions](/docs/conventions/shared-contracts.md) — how
  `packages/shared` is changed. A contract change breaks the API and both
  frontends at once, so all three move together.
