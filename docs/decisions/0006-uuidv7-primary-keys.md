# 6. UUIDv7 primary keys

Status: accepted

## Context

Three candidate primary keys, three sets of problems:

- **Auto-increment integers** leak information (how many users you have, how many orders were
  placed last week) and make ids guessable, which turns every missing authorization check
  into an enumeration vulnerability. They also make merging data from two environments or
  two shards painful.
- **UUIDv4** fixes both of those, and breaks index locality. Random 128-bit keys insert into
  arbitrary positions of the B-tree, so the working set is the whole index rather than its
  right edge, and page splits are constant. They also carry no ordering, so every list query
  needs a separate `createdAt` sort column and a composite index.
- **UUIDv7** is a random UUID with a millisecond Unix timestamp in its high bits. It is
  unguessable like v4 and monotonically increasing like a sequence.

## Decision

Every primary key in the schema is `String @id @default(uuid(7))`. All 15 models declare it;
`grep -n 'autoincrement\|@@id\|Int @id' apps/api/prisma/schema.prisma` returns nothing.

The time-ordering is not decorative — it is load-bearing. Nine repositories order by
`id: 'desc'` on the explicit premise that "UUIDv7 ids are time-ordered — id order IS creation
order", which is what makes [ADR 5](./0005-cursor-pagination-by-default.md)'s single-column
cursor possible. The supporting indexes are declared per read: `@@index([userId, id])`,
`@@index([status, id])`, `@@index([type, id])`, `@@index([audience, id])`.

External identifiers are never promoted to primary keys. A Stripe subscription id, a
payment-intent id and a provider event id live in their own `VarChar` columns
(`providerRef`, `providerCustomerRef`, `providerEventId`) with composite `@@unique`
constraints — `@@unique([provider, providerRef])`,
`@@unique([provider, providerEventId])` — so the row keeps its own identity and a change of
payment provider does not rewrite every foreign key.

## Consequences

**Good**

- Inserts append to the right edge of the index, like a sequence. No random-write
  amplification, no constant page splits.
- Ids are unguessable, so an id in a URL is not an enumeration oracle. `NoteService` relies on
  this explicitly: it returns 404 for a missing note and 403 for someone else's, and the
  comment records that leaking existence the other way around is acceptable *because* ids are
  not guessable.
- Sorting and cursoring need one column, not two. No `createdAt` tie-breaker, no composite
  cursor encoding.
- Ids can be generated anywhere without coordination — client, worker, test fixture, another
  service.

**Bad — pay these knowingly**

- **A UUIDv7 leaks its creation time.** The timestamp is in the id by construction, in
  milliseconds. Anyone holding an id knows when the row was created, and anyone holding two
  ids knows their order. For a note or an invoice that is fine; for something where creation
  time is itself sensitive, it is a disclosure. It also makes ids partially predictable in
  the *time* dimension — the randomness, not the ordering, is what makes them unguessable.
- **The keys are wide.** 36-character text primary keys, repeated in every foreign key and
  every index, cost more storage and more memory per index page than a 4- or 8-byte integer.
  This is the standard UUID tax and it is paid on every table.
- **They are unpleasant to type.** Debugging, support tickets and manual SQL all involve
  copy-pasting 36-character strings. There is no short human-facing identifier anywhere in
  the schema.

**Where the invariant is weaker than it looks**

- **The database does not enforce it.** `@default(uuid(7))` is a *Prisma Client* default, not
  a column default: the generated migrations declare `"id" TEXT NOT NULL` with no
  `DEFAULT`. Any insert that bypasses Prisma Client — raw SQL, a `psql` session, a restore
  from a foreign dump — can put an arbitrary string in a primary key, and cursor pagination
  will silently misorder it with no error anywhere.
- **Not every identifier in the system is a UUIDv7.** `File.key` — the S3 object path — is
  built from Node's `randomUUID()`, which is v4 (`files/{userId}/{v4}`), while the row's own
  `File.id` is v7. `X-Request-Id` and Redis lock tokens are also v4. The rule covers primary
  keys, not identifiers in general.
- `ApiKey.hashedKey` (a unique SHA-256 hex string) functions as a secondary natural key for
  guard lookups. It is `@unique`, not `@id`, but it is the column the hot path actually
  searches on.
