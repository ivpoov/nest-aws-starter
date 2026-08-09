# Architecture decision records

One page per decision that would otherwise be re-argued every six months. Each follows the
same shape — **Context** (what forced a choice), **Decision** (what was chosen, with the code
that implements it), **Consequences** (what it bought and what it cost).

An ADR that lists only benefits is marketing. Every page here states the bad consequences
too, and, where the code has since drifted from the decision, says so.

| # | Decision | The cost, in one line |
|---|---|---|
| 1 | [Depend on contracts, never on implementations](./0001-contracts-over-implementations.md) | Boilerplate per entity, no ad-hoc queries, enforced by review rather than tooling |
| 2 | [Fastify, not Express](./0002-fastify-over-express.md) | `FastifyRequest` typed into 16 files, app-wide `rawBody`, hand-rolled Swagger auth |
| 3 | [Tokens live in Redis, never in Postgres](./0003-tokens-in-redis-never-postgres.md) | Redis becomes a hard availability and durability dependency for auth |
| 4 | [Bearer tokens, no cookies](./0004-bearer-tokens-no-cookies.md) | CSRF is impossible; an XSS in either SPA takes a 30-day refresh token |
| 5 | [Cursor pagination by default](./0005-cursor-pagination-by-default.md) | No page numbers, no totals, fixed ordering — and one footgun that has fired |
| 6 | [UUIDv7 primary keys](./0006-uuidv7-primary-keys.md) | Ids leak creation time; the database does not enforce the format |
| 7 | [ESM only](./0007-esm-only.md) | Alias table duplicated three ways, `verbatimModuleSyntax` off for the API |
| 8 | [Modular by subtraction](./0008-modular-by-subtraction.md) | 257 markers in the source, no per-PR enforcement, unbalanced fences fail silently |
| 9 | [Newest stable minus thirty days](./0009-newest-stable-minus-thirty-days.md) | Security patches wait out the soak like everything else |
| 10 | [Two cost profiles and the no-NAT trade-off](./0010-two-cost-profiles-and-the-no-nat-trade-off.md) | On the demo profile tasks and the database subnet group sit in public subnets |

See [`../architecture.md`](../architecture.md) for how the pieces fit together.
