# 9. Dependencies: newest stable, minus thirty days

Status: accepted

## Context

Two dependency policies fail in opposite directions. Staying on the newest release the moment
it lands means being the person who discovers that a patch release broke something, or — much
worse — being in the blast radius of a compromised publish, which is typically caught and
unpublished within days. Staying deliberately behind means accumulating a migration debt that
eventually has to be paid all at once, and running with known advisories in the meantime.

A starter is forked and then left alone for months. It should be current when it is cloned
and it should never have been the ecosystem's crash-test dummy.

## Decision

Track the newest stable release, but only after it has been published for **30 days**.

`renovate.json` is twelve lines:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "minimumReleaseAge": "30 days",
  "rangeStrategy": "pin",
  "packageRules": [
    { "matchUpdateTypes": ["minor", "patch"], "groupName": "non-major dependencies" }
  ]
}
```

Two of those lines carry the whole policy:

- `minimumReleaseAge: "30 days"` applies globally, with **no exclusions** — not even for
  security patches.
- `rangeStrategy: "pin"` is what makes the soak real. Every direct dependency in every
  `package.json` is an exact version (`"fastify": "5.8.5"`, `"@nestjs/common": "11.1.27"`), so
  nothing can float past the soak on a caret range.

Minor and patch updates are grouped into a single PR; majors arrive individually.

Two CI jobs cover the window the soak leaves open:

- `pnpm audit --prod --audit-level high` on every PR.
- A weekly OSV scan (`google/osv-scanner-action`, SHA-pinned) plus a run on every PR — because
  a dependency that was clean the day it merged goes vulnerable without a line of this
  repository changing, and only a schedule catches that.

`osv-scanner.toml` deliberately contains **zero** suppressions. Its policy block requires any
future entry to be transitive, build- or dev-time only, to record why it is unreachable in
production, and to carry an `ignoreUntil` date.

## Consequences

**Good**

- The 30-day window is long enough that a compromised or catastrophically broken publish has
  usually been yanked before it can be adopted here.
- Exact pins mean a clone from six months ago installs exactly what it was tested with, and
  `pnpm-lock.yaml` diffs are readable.
- Grouping non-majors keeps the update PR volume to roughly one per cycle.

**Bad — pay these knowingly**

- **A security patch waits 30 days like everything else.** There is no
  `vulnerabilityAlerts` block and no carve-out rule. When an advisory lands against a pinned
  direct dependency, the process is: the audit or OSV job goes red, and a human raises the
  version by hand. The policy trades mean-time-to-patch for supply-chain safety, and that is a
  real trade, not a free one.
- **Nothing in this repository enforces the policy.** Renovate runs as a hosted GitHub app;
  there is no Renovate workflow in `.github/workflows/` and no `dependabot.yml`. Fork the
  repo without enabling Renovate and the policy is inert — the pins simply freeze.
- **No `lockFileMaintenance`.** Transitive dependencies are only refreshed when something
  direct moves, so the lockfile can carry an old transitive for a long time.
- **The policy was undocumented until this ADR.** Neither `README.md` nor `CONTRIBUTING.md`
  mentions the 30-day rule.

**Where it is bent, and by hand**

The interesting exceptions are not in `renovate.json` at all — they are `overrides` in
`pnpm-workspace.yaml`, each one pulling a *transitive* dependency past an advisory its parent
has not picked up yet:

```yaml
overrides:
  find-my-way: ">=9.7.0"
  "@fastify/static": ">=10.1.2"
  js-yaml: ">=4.3.1"
  helmet: "8.2.0"
  nanoid: "3.3.17"
  shell-quote: "1.9.0"
  "@prisma/dev": "0.24.17"
```

- **`helmet` is a manual re-implementation of the soak.** Its own `^8.0.0` range would float
  onto releases younger than 30 days, so the pin exists to apply the policy where Renovate
  cannot. The comment says to raise it the same way Renovate would: once the newer version has
  been out for 30 days. Nothing automates that.
- **Three of the seven overrides are open-ended ranges**, which is in direct tension with
  `rangeStrategy: "pin"`. The file explains why the other three are exact (a newer major on
  npm that the parent cannot accept — `nanoid` 6 is ESM-only and would take `postcss` with
  it) but does not explain why `find-my-way`, `@fastify/static` and `js-yaml` are allowed to
  float.
- The remaining pins each cite their advisory: `nanoid` GHSA-2v37-7h3g-55p8, `shell-quote`
  GHSA-395f-4hp3-45gv, and `@prisma/dev` clearing seven at once.
