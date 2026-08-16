# Shared Contract Conventions

`packages/shared` — the wire contracts

One package, three consumers: `apps/api` writes the responses, `apps/web` and
`apps/admin` read them. `@nest-aws-starter/shared` is the single place where the
*shape* of everything that crosses HTTP is written down, so the compiler — not a
test, not a code review, not production — is what catches a producer and a consumer
drifting apart.

The package is deliberately tiny and deliberately inert: 75 interfaces, 17 string
enums, 7 type aliases and 7 constants files at the time of writing, with **zero
runtime dependencies** (`packages/shared/package.json` has one devDependency,
`typescript`). It builds with plain `tsc` to `dist/`, and Turborepo's
`"dependsOn": ["^build"]` makes every app build wait for it.

---

## 1. What belongs here

Exactly one thing: **shapes that cross HTTP or the socket boundary between the API
and a browser app.**

| Belongs | Why |
|---|---|
| Response interfaces (`UserResponseInterface`, `NotificationListResponseInterface`) | Written by the API, read by both apps |
| Request interfaces (`LoginRequestInterface`, `CreateApiKeyRequestInterface`) | Written by an app, read by the API |
| Query interfaces (`NotificationsQueryRequestInterface`, `CursorPaginationQueryInterface`) | Same, for query strings |
| Enums whose values appear on the wire (`UserRoleEnum`, `NoteStatusEnum`, `TransactionStatusEnum`) | Both sides must agree on the literal strings |
| Error-code lists (`AUTH_ERROR_CODES`) and their derived types | A UI branches on `code`; the list is the contract |
| The error envelope itself (`ApiErrorInterface`) | Every non-2xx response, everywhere |

## 2. What does not

| Does not belong | Where it lives instead |
|---|---|
| Domain models (Prisma-shaped, `Date`-carrying, with fields the wire never sees) | Module-private `apps/api/src/modules/<m>/interfaces/` ([`backend.md` §4](./backend.md)) |
| Repository contracts, service contracts, injection tokens | The owning API module |
| Enums that never cross HTTP — `OneTimeTokenKindEnum`, `WebhookEventStatusEnum`, `NormalizedEventTypeEnum`, `FileSweepOutcomeEnum`, `ErrorCategoryEnum` | `apps/api/src/modules/<m>/enums/` |
| UI-only state shapes — `AuthStoreInterface`, `TransactionFiltersInterface`, every `Use…ResultInterface` | The app's own `src/interfaces/` ([`frontend.md` §1](./frontend.md)) |
| Any runtime helper — formatters, validators, mappers, date utilities | The app or the API. `formatMoney` lives in each frontend's own `utils/` on purpose |
| Config, env parsing, secrets | `apps/api/src/configs` |
| Socket event names | Duplicated, on purpose — see below |

**Socket event names are the one shared-looking thing that is deliberately not
shared.** `NOTIFICATION_EVENT = 'notification'` exists three times: in
`apps/api/src/modules/notification/constants/notification-events.constants.ts` and in
each app's `src/constants/notification-events.constants.ts`, mirroring it
literal-for-literal with a comment saying so. The reasoning is recorded in the file:
an event *name* is transport metadata, not a request/response shape. The event's
*payload* is shared — it is `NotificationResponseInterface`.

The test for anything you are tempted to add: **would both an API file and an app
file import it?** If only one side would, it belongs to that side. A shared package
that accumulates one-sided types stops being a contract and becomes a dumping ground,
and every fork of this starter inherits the pile.

## 3. Review rejections

These are the shapes that get a contract change sent back. The middle column is the
reason, because the same symptom is fine in an app and wrong in a shared package.

| Symptom | Why it fails | Do this |
|---|---|---|
| `readonly createdAt: Date` in a contract | `Date` does not survive JSON; the client receives a string and the types lie | `readonly createdAt: string` (ISO-8601) |
| `readonly amount: number` holding 19.99 | Binary floats cannot represent money; the error compounds on every sum | `readonly amountCents: number` holding 1999 |
| A response DTO without `implements XResponseInterface` | Nothing then couples the DTO to the contract — they drift silently and the compiler never notices | Add it; that clause is the whole drift check |
| An app-local interface mirroring a shared one | Two definitions of one wire shape, and only one gets updated | Import the shared one |
| A domain interface — Prisma fields, `Date`s — exported from `shared` | Ships persistence detail to a browser and makes the schema a public contract | Keep it module-private in the API |
| A `Use…ResultInterface` or store shape in `shared` | It is one app's internal state, not a wire contract; the other consumer inherits noise | The app's own `src/interfaces/` |
| A formatter or validator in `shared` | The package stops being inert, and every consumer inherits a runtime dependency | Put it in the consumer that needs it |
| A deep import (`@nest-aws-starter/shared/dist/...`) | Reaches past the barrel into build output that is free to move | The `index.ts` barrel |
| A relative import inside `shared` without `.js` | `nodenext` resolves the specifier literally; the build fails at the consumer, not here | `from './x.interface.js'` |
| A new export missing from `index.ts` | Invisible to consumers, and the module fence has nothing to remove | Add the line, with its `// <module:x>` marker |
| Shipping a contract change without its consumers | Leaves `main` in a state where the API and the frontends disagree | One PR across all three workspaces |

## 4. Layout and naming

Feature folder, then artifact kind, one declaration per file — the same rule as
[`backend.md` §2](./backend.md):

```
packages/shared/src/
├── index.ts                     # the single barrel — every export, alphabetised
├── common/
│   ├── enums/sort-order.enum.ts
│   └── interfaces/api-error.interface.ts
├── notifications/
│   ├── enums/notification-type.enum.ts
│   └── interfaces/notification-response.interface.ts
└── payments/
    ├── constants/payment-error-codes.constants.ts
    ├── enums/transaction-status.enum.ts
    ├── interfaces/public-plan-response.interface.ts
    └── types/payment-error-code.type.ts
```

- Naming: `XResponseInterface` for what the API returns, `XRequestInterface` for what
  it accepts, `XQueryInterface`/`XRequestInterface` for query strings.
- **Every property `readonly`.** No exceptions in the package today.
- **Optional means `?: T | undefined`**, explicitly — both apps compile with
  `exactOptionalPropertyTypes`, so `?: T` alone would not accept an explicit
  `undefined`.
- **Nothing is `any`** (`biome.json`, `suspicious.noExplicitAny`), and nothing is a
  bare `object` or index signature except where the payload genuinely is open —
  `NotificationResponseInterface.meta: Record<string, unknown>`.
- The package compiles with `module: nodenext`, so **relative imports inside the
  package carry the `.js` extension**: `from '../enums/notification-type.enum.js'`.
  That is required, not stylistic.
- **`index.ts` is the only barrel** and the only entry point (`exports` in
  `package.json` names it alone). Nothing imports a deep path.
- Exports belonging to an optional module carry a `// <module:x>` marker on their
  `index.ts` line, so `scripts/subtraction-test.mjs` can delete them with the module.
  Add the marker in the same commit that adds the export.
- **A comment on a contract explains the decision, not the fields.** The good ones in
  this package say why a shape is *narrower* than its sibling
  (`PublicPlanResponseInterface` omits provider refs and `isActive`), or what a
  nullable field means (`NotificationResponseInterface.readAt` is "always null on the
  WS push — a row is brand new at the moment it is emitted"). That is knowledge a
  consumer cannot recover from the types.

## 5. Dates are ISO-8601 strings

**No `Date` appears anywhere in `packages/shared`.** Every timestamp is
`readonly createdAt: string`, and every nullable one is `string | null`.

This is not a stylistic preference — it is what the wire actually carries. `JSON.stringify`
turns a `Date` into a string, so a contract typed `Date` would describe a value that
never exists on either side of the connection: the API serialises it away and the
browser receives a string that TypeScript would happily let you call `.getTime()` on.

The two sides honour it explicitly:

- **API** — a response DTO implements the *wire* interface, not the `Date`-carrying
  domain interface, and converts at the edge:

  ```typescript
  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;
  ```

  Nullable dates use `value?.toISOString() ?? null`. `apps/api/src/modules/note/dtos/responses/note-response.dto.ts`
  carries the comment that states the rule: *"the wire tells the truth"*.
- **Frontend** — an app that produces a timestamp produces the string form too.
  `useTransactionFilters` normalises a date-picker's `YYYY-MM-DD` to
  `${value}T00:00:00.000Z`; `useNotificationList` writes `new Date().toISOString()`
  into an optimistic `readAt`.

Parse to a `Date` at the point of display and nowhere else. `date`-typed values that
are not instants — `StatisticsSeriesPointInterface.date` is a `YYYY-MM-DD` day
bucket — say so in a comment on the field.

## 6. Money is an integer count of cents

Every monetary amount on the wire is a **whole number of minor currency units**,
named with a `Cents` suffix, and paired with a `currency` string where the currency
is not otherwise fixed:

```typescript
export interface PublicPlanResponseInterface {
  readonly amountCents: number;   // 1900, not 19 and never 19.0
  readonly currency: string;      // 'USD'
  // …
}
```

Floating-point money is a correctness bug waiting for a rounding: `0.1 + 0.2` is not
`0.3` in IEEE-754, and a currency total assembled from float components drifts by
cents that eventually have to be explained to somebody. Integers do not drift.

The rules:

- **Never divide before the very last step** — rendering. `utils/formatMoney.ts` in
  each frontend is that step:
  ```typescript
  export function formatMoney(amountCents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
      amountCents / 100,
    );
  }
  ```
  (The admin copy wraps the same call in a `try`/`catch` so an unrecognised currency
  code degrades to `19.00 USD` instead of throwing inside a chart render.)
- **A form that must show major units converts at both edges.**
  `apps/admin/src/components/Plans/PlanFormModal.tsx` seeds its input with
  `(amountCents / 100).toFixed(2)` and converts back through `toAmountCents` before
  submitting — the value that leaves the component is an integer, and nothing
  in between holds a float.
- **Sum, subtract and compare in cents**, on both sides. The revenue TypedSQL queries
  aggregate integer cents; the API passes the integer through.
- **The suffix is the documentation.** A reader seeing `amountCents: 1900` cannot
  misread it; a reader seeing `amount: 1900` has to go find out. Name the field for
  its unit even when it feels verbose.

Multi-currency arithmetic is out of scope for the starter: the statistics module
filters to one reporting currency (`STATISTIC_REPORTING_CURRENCY`) rather than
pretending amounts in different currencies can be added.

## 7. `implements` — the drift protection

A shared interface is only worth having if something breaks when a side stops
matching it. Both sides are wired so something does.

**The API side: response and request DTOs `implements` the shared interface.**

```typescript
// apps/api/src/modules/note/dtos/responses/note-response.dto.ts
export class NoteResponseDto implements NoteResponseInterface { … }

// apps/api/src/modules/auth/dtos/login.dto.ts
export class LoginDto implements LoginRequestInterface { … }
```

`implements` costs nothing at runtime and buys the whole guarantee. Drop a field from
the DTO and the class stops satisfying the interface — a build error in `apps/api`,
at the line that caused it. Rename a field in the interface and every DTO that still
uses the old name fails at once. Without it, the DTO and the contract are two
documents that agree only as long as somebody remembers.

Note what is *not* the same object: the DTO implements the **wire** interface while
the module's domain interface stays private and keeps its `Date`s and its internal
fields. The DTO is the seam where domain becomes wire, and `implements` is what
proves it landed on the right shape.

**The frontend side: contracts are the type argument, never a local restatement.**

```typescript
export function fetchUnreadCount(): Promise<UnreadCountResponseInterface> {
  return apiClient.get<UnreadCountResponseInterface>('/notifications/unread-count');
}
```

`apiClient` is generic, so the shared interface is the only thing describing the
response — remove a field from the contract and every component reading it fails to
compile. The same applies to request params:
`fetchNotifications(params: NotificationsQueryRequestInterface)` takes the shared
query contract verbatim rather than an app-local echo of it.

**Never declare an app-local interface that mirrors a shared one.** A copy compiles
forever after the original changes, which is precisely the failure the package
exists to prevent.

## 8. Change discipline

**A contract change is a breaking change for two consumers at once.** There is no
deployment order that makes it not one — a field the API stopped sending is a field
both browser apps still read.

- **One PR, all three workspaces.** The shared change, the API DTO, and every call
  site in `apps/web` and `apps/admin` land together. `pnpm run build` is the gate:
  Turborepo builds `shared` first, then type-checks both apps against it, so an
  un-updated consumer fails CI. Splitting the change across PRs means merging a red
  build on purpose.
- **Additive changes are cheap; the others are not.** Adding an optional field costs
  nothing. Removing a field, renaming one, narrowing a type, tightening `T | null` to
  `T`, or adding a member to an enum a `switch` handles exhaustively — each one needs
  every consumer checked in the same change.
- **Widening a union is a consumer change too.** A new `NotificationTypeEnum` member
  means `apps/web` needs a label for it
  (`apps/web/src/constants/notification-type-labels.constants.ts`) and both apps'
  deep-link resolvers need a case (`src/utils/resolveNotificationLink.ts`). The
  compiler only tells you where the mapping is total: `NOTIFICATION_TYPE_LABELS` is a
  `Record<NotificationTypeEnum, string>` and fails to compile, while
  `NOTIFICATION_LINKS` is a `Partial<Record<…>>` and silently resolves to `null`.
  Grep for the enum's other uses; prefer a total `Record` when every member really
  does need an entry.
- **Removing an error code is a breaking change.** UIs branch on `code` strings, so a
  code is as much a contract as a field name. Add to the `as const` array; the derived
  `…ErrorCodeType` updates itself.
- **Adding an export means adding the `index.ts` line**, in the same commit, with the
  `// <module:x>` marker if it belongs to an optional module.
- **Commit the contract on its own.** `feat(shared): …` for the contract, then the
  API change, then the frontend change — one logical unit each, per
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md). The history then shows what the contract
  was at every point.
- **Swagger is generated from the DTO, so it follows for free** — as long as the DTO
  is what changed. A field added to the interface but not to the DTO is invisible in
  the docs *and* absent from the response.
