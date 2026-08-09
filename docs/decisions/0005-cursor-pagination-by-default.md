# 5. Cursor pagination by default

Status: accepted

## Context

`LIMIT 20 OFFSET 10000` makes the database read and discard 10 000 rows before returning
anything. The cost grows linearly with page depth, and the reader can silently miss or
duplicate rows when the underlying set changes between page requests. Both problems are
invisible on a seeded dev database with 30 rows and unavoidable on a real one.

The starter also has a property that makes the alternative cheap: primary keys are UUIDv7
([ADR 6](./0006-uuidv7-primary-keys.md)), so id order *is* creation order. A cursor does not
need a composite `(createdAt, id)` tuple or a separate sort column — the primary key alone
is a total, time-ordered cursor with an index already on it.

## Decision

List endpoints paginate by cursor. The shared primitives are
`CursorPaginationInterface` (`cursor: string | null`, `limit: number`) and
`CursorPaginationQueryDto` (`limit` defaults to 20, capped at 100 by `@Max(100)`;
`cursor` validated as a UUID). Feature query DTOs extend the cursor DTO rather than
redefining paging.

Repositories order by `id: 'desc'` and take one of two forms:

- **Unfiltered lists** use Prisma's cursor plus `skip: 1` to drop the cursor row itself
  (`NotePrismaRepository.findManyAfter`).
- **Filtered lists must use keyset** — the comparison goes in the `where`
  (`...(pagination.cursor && { id: { lt: pagination.cursor } })`), because `skip: 1` assumes
  the cursor row is still the first row the query matches. As soon as the filter is on state
  a row can leave (a status, a read flag), the filter has already excluded the cursor row and
  the offset eats the *next* legitimate row instead. `NotificationPrismaRepository` is the
  correct example.

Offset pagination is permitted only for bounded admin tables that genuinely need page
numbers, always with a hard limit cap. `PaginationQueryDto` / `PaginationInterface` exist for
that case.

The service computes the next cursor from the page it just returned — if the page is full,
the last item's id is `nextCursor`; otherwise `null` (`NoteService.findMany`).

## Consequences

**Good**

- Page cost is constant regardless of depth. Every paginated query is an index range scan,
  and the indexes exist for it: `@@index([userId, id])`, `@@index([status, id])`,
  `@@index([type, id])`, `@@index([audience, id])` and friends are declared for exactly these
  reads.
- No skipped or duplicated rows when new items arrive during paging — a new row sorts above
  the cursor and simply is not in the current traversal.
- The wire contract is small: one opaque string. Clients cannot construct a page-42 deep link
  and accidentally DoS the database.

**Bad — pay these knowingly**

- **No page numbers, no total count, no jump-to-last.** A UI that wants "page 7 of 39" cannot
  have it. This is the single most common request when someone adds an admin table, and the
  honest answer is "use the offset DTO for that table, with a cap".
- **Ordering is fixed to the cursor column.** Sorting a cursor-paginated list by name, price
  or `lastActiveAt` requires a different cursor design (a composite keyset) or a different
  pagination strategy. Today every cursor list is newest-first by id, full stop.
- **Two correct shapes, one of which is subtly wrong in the other's context.** The `skip: 1`
  form and the keyset form look nearly identical at a glance and differ only in whether a
  mutable filter is present. This is a footgun, and it has already fired — see below.

**Where it is bent**

- **The keyset rule is violated in three filtered lists.** `ContactMessagePrismaRepository`
  (filters on `status`, which an admin flips from `OPEN` to `RESOLVED` in the same file),
  `PaymentTransactionPrismaRepository.findManyForAdmin` (filters on `status`, which can move
  to `REFUNDED`), and `UserPrismaRepository`'s admin search (filters on a mutable
  `displayName`) all use `cursor` + `skip: 1` over mutable filters. Resolving the cursor row
  and then paging forward silently skips a row. `ActivityPrismaRepository` uses the same
  shape but is safe by accident: the activity table is append-only and its filters are
  immutable.
- **The offset escape hatch is dead code.** `PaginationQueryDto` has zero consumers — the
  rule is not so much bent as never tested in anger.
- **Several list endpoints are not paginated at all.** `GET /billing/plans` (public),
  `GET /sessions`, `GET /auth/methods`, `GET /notifications/preferences` and the admin
  statistics endpoints return an unbounded set with no `take`. Each has a naturally small
  row count today; none of them has a cap enforcing that.
