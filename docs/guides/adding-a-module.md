# Adding a module

A literal, end-to-end walkthrough: we build a **`bookmark`** module — saved URLs,
one row per owner per URL — from an empty folder to a green `pnpm run build`,
`pnpm run test`, `pnpm --dir apps/api run test:e2e` and
`node scripts/subtraction-test.mjs`, and then prove it can be deleted again.

Every file below was created exactly as written, and every command was run
against this repository. If one stops working, that is a bug in this document.

The rules being applied come from [`docs/conventions/backend.md`](../conventions/backend.md)
(binding for `apps/api`) and [`docs/conventions/shared-contracts.md`](../conventions/shared-contracts.md)
(binding for `packages/shared`). This page does not restate them; it shows what
following them actually looks like. The shipped `note` module is the second
reference — when this page and `note` disagree, `note` wins, because CI runs it.

## What we are building

| | |
|---|---|
| Resource | `POST/GET/PATCH/DELETE /api/v1/bookmarks` |
| Owned by | the authenticated user; a bookmark is never visible to anyone else |
| Stored as | `bookmarks` table — `url`, `title`, `isFavorite`, timestamps |
| Rule worth having | `@@unique([userId, url])` — re-bookmarking a URL is a `409`, not a duplicate row |
| Listing | cursor pagination, newest first |

That unique constraint is the reason this example is a bookmark and not a second
notes module: it forces the walkthrough through **two** Prisma error codes
(`P2025` *and* `P2002`), a `ConflictError`, and a field (`url`) that is
deliberately not patchable.

Before you start:

```bash
docker compose up -d --wait     # Postgres, Redis, LocalStack, MinIO
pnpm install
```

## 0. Think in contracts before you think in tables

The order below is not arbitrary. Each step depends only on the ones above it,
which is the same direction the dependency rule points:

```
Controller  →  Service  →  RepositoryInterface  ←implements←  PrismaRepository
   HTTP         business        contract                       database detail
```

So we write the wire contract first (what the browser sees), then the database
(what Postgres stores), then the contract that hides the database, then the
service that never learns Postgres exists, and only then the HTTP edge.

One naming rule to internalise up front, because it decides half the filenames:
**one declaration per file, and the folder is the artifact kind.** A module
never has a loose `bookmark.service.ts` at its root. The only root-level file is
`bookmark.module.ts`.

## 1. The wire contracts — `packages/shared`

These are the shapes that cross HTTP. Both frontends and the API compile against
them, which is what turns a contract drift into a build error instead of a
production surprise.

Note the import style here: inside `packages/shared` imports are **relative and
carry `.js`** (the package compiles with `module: nodenext`). The `@modules/...`
path aliases are an `apps/api` feature and do not exist in this package — nor in
`apps/web` / `apps/admin`, which use relative imports throughout.

```typescript
// packages/shared/src/bookmarks/constants/bookmark-error-codes.constants.ts
export const BOOKMARK_ERROR_CODES = [
  'BOOKMARK_NOT_FOUND',
  'BOOKMARK_ACCESS_DENIED',
  'BOOKMARK_ALREADY_EXISTS',
] as const;
```

```typescript
// packages/shared/src/bookmarks/types/bookmark-error-code.type.ts
import type { BOOKMARK_ERROR_CODES } from '../constants/bookmark-error-codes.constants.js';

export type BookmarkErrorCodeType = (typeof BOOKMARK_ERROR_CODES)[number];
```

A UI branches on the `code` string of an error envelope, so the list of codes is
as much a contract as any field name. Deriving the type from the `as const` array
means adding a code updates the type for free.

```typescript
// packages/shared/src/bookmarks/interfaces/create-bookmark-request.interface.ts
export interface CreateBookmarkRequestInterface {
  readonly url: string;
  readonly title: string;
  readonly isFavorite?: boolean | undefined;
}
```

`?: boolean | undefined` — spelled out, not `?: boolean`. Both frontends compile
with `exactOptionalPropertyTypes`, so the bare optional would reject an explicit
`undefined`.

```typescript
// packages/shared/src/bookmarks/interfaces/update-bookmark-request.interface.ts
import type { CreateBookmarkRequestInterface } from './create-bookmark-request.interface.js';

// `url` is deliberately not updatable: it is the identity of a bookmark (one row
// per owner per URL), so re-pointing one is a delete plus a create, not a patch.
export type UpdateBookmarkRequestInterface = Partial<Omit<CreateBookmarkRequestInterface, 'url'>>;
```

Derived, never hand-copied. A comment on a contract explains the *decision*, not
the fields.

```typescript
// packages/shared/src/bookmarks/interfaces/bookmark-response.interface.ts
export interface BookmarkResponseInterface {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly isFavorite: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
```

`createdAt` is a **`string`**, not a `Date`. No `Date` appears anywhere in
`packages/shared`, because no `Date` ever appears on the wire — `JSON.stringify`
turns it into an ISO-8601 string long before the browser sees it. There is also
no `userId` field: the caller is the owner by construction, so shipping it would
be noise the client cannot use.

```typescript
// packages/shared/src/bookmarks/interfaces/bookmark-list-response.interface.ts
import type { BookmarkResponseInterface } from './bookmark-response.interface.js';

export interface BookmarkListResponseInterface {
  readonly items: BookmarkResponseInterface[];
  readonly nextCursor: string | null;
}
```

Finally, the barrel. `packages/shared/src/index.ts` is the only entry point, its
lines are alphabetised, and every export belonging to an **optional** module
carries a `// <module:x>` fence marker (section 14 explains what those do). Add
these six lines between the `auth/…` block and the `common/…` block:

```typescript
// packages/shared/src/index.ts
export * from './bookmarks/constants/bookmark-error-codes.constants.js'; // <module:bookmark>
export * from './bookmarks/interfaces/bookmark-list-response.interface.js'; // <module:bookmark>
export * from './bookmarks/interfaces/bookmark-response.interface.js'; // <module:bookmark>
export * from './bookmarks/interfaces/create-bookmark-request.interface.js'; // <module:bookmark>
export * from './bookmarks/interfaces/update-bookmark-request.interface.js'; // <module:bookmark>
export * from './bookmarks/types/bookmark-error-code.type.js'; // <module:bookmark>
```

## 2. The Prisma model

`apps/api/prisma/schema.prisma`. Two edits: a back-relation on `User`, and the
model itself wrapped in fence markers.

On `User`, next to the other optional-module relations:

```prisma
  bookmarks               Bookmark[] // <module:bookmark>
```

And the model, after the `// </module:note>` block:

```prisma
// <module:bookmark>
model Bookmark {
  id         String   @id @default(uuid(7))
  userId     String
  url        String   @db.VarChar(2048)
  title      String   @db.VarChar(255)
  isFavorite Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // One row per owner per URL — the conflict rule the service turns into a 409
  @@unique([userId, url])
  // UUIDv7 cursor pagination scans per owner
  @@index([userId, id])
  @@map("bookmarks")
}

// </module:bookmark>
```

Four schema rules are being obeyed at once:

- **`uuid(7)` primary keys.** UUIDv7 is time-ordered, so `ORDER BY id` *is*
  `ORDER BY createdAt` and cursor pagination needs no second column.
- **An explicit `@@index` for every column combination you will `where`/`orderBy`
  on**, in the same migration that introduces the query. `@@index([userId, id])`
  is what makes the paged list a range scan instead of a sort. "Prisma made the
  FK" is not an index.
- **`onDelete: Cascade`** — a deleted user takes their bookmarks with them.
- **`@@map`** — snake-case plural table names; the model stays PascalCase.

## 3. The migration (and how to do it against a database you share)

```bash
pnpm --dir apps/api exec prisma migrate dev --name add_bookmark
```

This writes `apps/api/prisma/migrations/<timestamp>_add_bookmark/migration.sql`,
applies it to whatever `DATABASE_URL` points at, and regenerates the Prisma
client. Read the SQL it produced before doing anything else — it is the artifact
that will run against production one day:

```sql
-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookmarks_userId_id_idx" ON "bookmarks"("userId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_url_key" ON "bookmarks"("userId", "url");

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

### The awkward part

`migrate dev` is not a dry run. It mutates the database now, and it may decide
your database has *drifted* from the migration history and offer to reset it —
which drops every table. On a laptop that is a shrug. On a Postgres instance
somebody else is also using — a shared dev box, a teammate's branch, another
process mid-test — it is a bad afternoon.

**Point it at a scratch database instead.** The compose stack's Postgres is happy
to hold more than one:

```bash
docker exec nest-aws-starter-postgres-1 \
  psql -U postgres -c 'CREATE DATABASE starter_scratch;'
```

Then set `DATABASE_URL` in `apps/api/.env` to that database for the duration of
the work:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/starter_scratch?connection_limit=10
```

and bring it up to date before you start:

```bash
pnpm --dir apps/api exec prisma migrate deploy
```

`migrate deploy` only applies pending migrations and never resets anything, so
the scratch database ends up structurally identical to your dev one. Now
`migrate dev --name add_bookmark` has nothing shared to damage, and the whole
test suite in section 12 runs against the scratch database too. When you are
done, point `DATABASE_URL` back and `DROP DATABASE starter_scratch;`.

If you would rather work directly against your dev database, know how to reverse
one migration by hand before you run it — dropping the table is not enough,
because Prisma also recorded the migration as applied:

```bash
docker exec nest-aws-starter-postgres-1 psql -U postgres -d starter \
  -c 'DROP TABLE IF EXISTS "bookmarks";' \
  -c "DELETE FROM _prisma_migrations WHERE migration_name LIKE '%_add_bookmark';"
```

Leaving the row behind is worse than leaving the table: the next `migrate dev`
sees a migration marked applied whose effects are gone, calls that drift, and
offers to reset.

## 4. Domain interfaces

Now we are inside `apps/api`, where imports are **path aliases only**
(`@modules/...`, `@interfaces/...`) and every one of them ends in `.js` — the
package is native ESM and TypeScript's `nodenext` resolution wants the emitted
extension, not the source one. Relative imports are lint-blocked here.

The domain model is module-private. It is not the wire shape: it keeps `Date`s
and it keeps `userId`, which the response never carries.

```typescript
// apps/api/src/modules/bookmark/interfaces/bookmark.interface.ts
export interface BookmarkInterface {
  readonly id: string;
  readonly userId: string;
  readonly url: string;
  readonly title: string;
  readonly isFavorite: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

```typescript
// apps/api/src/modules/bookmark/interfaces/bookmark-list.interface.ts
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';

export interface BookmarkListInterface {
  readonly items: BookmarkInterface[];
  readonly nextCursor: string | null;
}
```

```typescript
// apps/api/src/modules/bookmark/interfaces/create-bookmark-data.interface.ts
export interface CreateBookmarkDataInterface {
  readonly userId: string;
  readonly url: string;
  readonly title: string;
  readonly isFavorite?: boolean | undefined;
}
```

The create input is a separate interface from the model, and it is not the DTO
either. The DTO is an HTTP shape (validated, decorated); this is what the service
hands the repository, `userId` included — the controller adds that from the token,
never the client.

```typescript
// apps/api/src/modules/bookmark/types/update-bookmark-data.type.ts
import type { CreateBookmarkDataInterface } from '@modules/bookmark/interfaces/create-bookmark-data.interface.js';

export type UpdateBookmarkDataType = Partial<Omit<CreateBookmarkDataInterface, 'userId' | 'url'>>;
```

This one is a `type`, not an `interface`, and lives in `types/` rather than
`interfaces/` — because it is *derived* (a utility composition), not authored.
Anything with named properties you are writing out by hand is an `interface`.

## 5. The repository contract and its token

```typescript
// apps/api/src/modules/bookmark/constants/bookmark.constants.ts
export const BOOKMARK_REPOSITORY = Symbol('BOOKMARK_REPOSITORY');
```

```typescript
// apps/api/src/modules/bookmark/interfaces/bookmark-repository.interface.ts
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';
import type { CreateBookmarkDataInterface } from '@modules/bookmark/interfaces/create-bookmark-data.interface.js';
import type { UpdateBookmarkDataType } from '@modules/bookmark/types/update-bookmark-data.type.js';

export interface BookmarkRepositoryInterface {
  // `null` = the owner already bookmarked this URL (unique constraint hit).
  create(data: CreateBookmarkDataInterface): Promise<BookmarkInterface | null>;
  findById(id: string): Promise<BookmarkInterface | null>;
  findManyAfter(
    userId: string,
    pagination: CursorPaginationInterface,
  ): Promise<BookmarkInterface[]>;
  update(id: string, data: UpdateBookmarkDataType): Promise<BookmarkInterface | null>;
  deleteById(id: string): Promise<boolean>;
}
```

Read that contract again and notice what is missing: no `where`, no `orderBy`, no
`Prisma.BookmarkWhereInput`, no ORM anything. Methods are named for intent
(`findManyAfter`), not for query shape. A new query shape means a new named
method here, never a query object passed in from the service.

The return types carry the module's whole failure vocabulary, in
database-neutral form:

| Return | Means | Service turns it into |
|---|---|---|
| `create → null` | unique constraint on `(userId, url)` | `ConflictError` |
| `findById → null` | no such row | `NotFoundError` |
| `update → null` | the row vanished between check and write | `NotFoundError` |
| `deleteById → false` | same, for deletes | `NotFoundError` |

## 6. The repository implementation — the only Prisma zone

This is the one file in the module allowed to import Prisma. Note the import
paths: the client is generated into the repository
(`apps/api/src/generated/prisma`), so it is `@generated/prisma/client.js` and
`@generated/prisma/models.js` — not `@prisma/client`. Model types are suffixed
`Model` (`BookmarkModel`).

```typescript
// apps/api/src/modules/bookmark/repositories/bookmark-prisma.repository.ts
import { Prisma } from '@generated/prisma/client.js';
import type { BookmarkModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';
import type { BookmarkRepositoryInterface } from '@modules/bookmark/interfaces/bookmark-repository.interface.js';
import type { CreateBookmarkDataInterface } from '@modules/bookmark/interfaces/create-bookmark-data.interface.js';
import type { UpdateBookmarkDataType } from '@modules/bookmark/types/update-bookmark-data.type.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BookmarkPrismaRepository implements BookmarkRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateBookmarkDataInterface): Promise<BookmarkInterface | null> {
    try {
      const bookmark: BookmarkModel = await this.prisma.bookmark.create({
        data: {
          userId: data.userId,
          url: data.url,
          title: data.title,
          ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
        },
      });

      return this.toDomain(bookmark);
    } catch (caught) {
      if (this.isUniqueViolation(caught)) return null;

      throw caught;
    }
  }

  public async findById(id: string): Promise<BookmarkInterface | null> {
    const bookmark: BookmarkModel | null = await this.prisma.bookmark.findUnique({
      where: { id },
    });

    return bookmark ? this.toDomain(bookmark) : null;
  }

  public async findManyAfter(
    userId: string,
    pagination: CursorPaginationInterface,
  ): Promise<BookmarkInterface[]> {
    const bookmarks: BookmarkModel[] = await this.prisma.bookmark.findMany({
      where: {
        userId,
        // `lt` pairs with `id: 'desc'` — keyset, not cursor + skip: 1
        ...(pagination.cursor && { id: { lt: pagination.cursor } }),
      },
      take: pagination.limit,
      // UUIDv7 ids are time-ordered — id order IS creation order.
      orderBy: { id: 'desc' },
    });

    return bookmarks.map((bookmark: BookmarkModel): BookmarkInterface => this.toDomain(bookmark));
  }

  public async update(id: string, data: UpdateBookmarkDataType): Promise<BookmarkInterface | null> {
    try {
      const bookmark: BookmarkModel = await this.prisma.bookmark.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
        },
      });

      return this.toDomain(bookmark);
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return null;

      throw caught;
    }
  }

  public async deleteById(id: string): Promise<boolean> {
    try {
      await this.prisma.bookmark.delete({ where: { id } });

      return true;
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return false;

      throw caught;
    }
  }

  // P2025 = record not found, mapped to a domain-neutral null/false so writes
  // stay atomic (no read-then-write race between the check and the update).
  private isRecordNotFound(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025';
  }

  // P2002 = unique-constraint hit on (userId, url). Letting the database decide
  // is the only race-free answer; a pre-check SELECT would still lose to a
  // concurrent insert.
  private isUniqueViolation(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002';
  }

  private toDomain(bookmark: BookmarkModel): BookmarkInterface {
    return {
      id: bookmark.id,
      userId: bookmark.userId,
      url: bookmark.url,
      title: bookmark.title,
      isFavorite: bookmark.isFavorite,
      createdAt: bookmark.createdAt,
      updatedAt: bookmark.updatedAt,
    };
  }
}
```

Three things to take from this file:

- **`toDomain` is not ceremony.** Without it a `BookmarkModel` — an ORM type —
  leaks into services, controllers and eventually the response, and the golden
  rule dies quietly. `BookmarkModel` appears here only as local variable types.
- **P2025 and P2002 are the only Prisma error codes allowed to be branched on,
  and only here.** They are the two cases where the database is answering a
  question rather than failing: "that row is gone" and "that row already exists".
  Everything else rethrows.
- **The list pages by keyset (`id: { lt: cursor }`), not by Prisma's
  `cursor` + `skip: 1`.** `skip: 1` exists only to drop the cursor row itself and
  assumes that row still matches the `where`. The moment you add a filter the row
  can fall out of — `isFavorite`, a status, a soft delete — the skip eats the next
  legitimate row instead and the reader silently never sees it. Putting the
  comparison in the `where` is correct for every filter combination.

Swapping Postgres for something else is one new file implementing
`BookmarkRepositoryInterface` plus one `useClass` line in section 11. Nothing
above this file changes. That is the whole point of the layering.

## 7. Error constants

```typescript
// apps/api/src/modules/bookmark/constants/bookmark-errors.constants.ts
import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const BOOKMARK_NOT_FOUND: ErrorArgsInterface = {
  code: 'BOOKMARK_NOT_FOUND',
  details: 'Bookmark not found',
};

export const BOOKMARK_ACCESS_DENIED: ErrorArgsInterface = {
  code: 'BOOKMARK_ACCESS_DENIED',
  details: 'This bookmark belongs to another user',
};

export const BOOKMARK_ALREADY_EXISTS: ErrorArgsInterface = {
  code: 'BOOKMARK_ALREADY_EXISTS',
  details: 'This URL is already bookmarked',
};
```

Codes are module-owned — there is no central registry file to edit, so deleting
the module deletes its codes. Two rules are enforced mechanically by
`apps/api/src/modules/common/errors/tests/error-codes.spec.ts`, which globs every
`*errors.constants.ts` in the tree:

- **the `code` string must equal the exported constant's name** (so grepping
  either finds the other), and
- **codes are globally unique.**

Get one wrong and `pnpm run test` fails with the file and export name in the
message. This is also why the codes are duplicated in
`packages/shared/src/bookmarks/constants/bookmark-error-codes.constants.ts`: that
array is the *wire* contract a UI branches on, this file is the API-side
constant. They are two sides of the same fact, and both are cheap to keep
aligned because both are one file.

## 8. The service — all the business logic, and the module's only export

```typescript
// apps/api/src/modules/bookmark/services/bookmark.service.ts
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import { BOOKMARK_REPOSITORY } from '@modules/bookmark/constants/bookmark.constants.js';
import {
  BOOKMARK_ACCESS_DENIED,
  BOOKMARK_ALREADY_EXISTS,
  BOOKMARK_NOT_FOUND,
} from '@modules/bookmark/constants/bookmark-errors.constants.js';
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';
import type { BookmarkListInterface } from '@modules/bookmark/interfaces/bookmark-list.interface.js';
import type { BookmarkRepositoryInterface } from '@modules/bookmark/interfaces/bookmark-repository.interface.js';
import type { CreateBookmarkDataInterface } from '@modules/bookmark/interfaces/create-bookmark-data.interface.js';
import type { UpdateBookmarkDataType } from '@modules/bookmark/types/update-bookmark-data.type.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { BOOKMARK_CREATED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class BookmarkService {
  private readonly logger = new CustomLoggerService(BookmarkService.name);

  constructor(
    @Inject(BOOKMARK_REPOSITORY)
    private readonly bookmarkRepository: BookmarkRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async create(data: CreateBookmarkDataInterface): Promise<BookmarkInterface> {
    const bookmark: BookmarkInterface | null = await this.bookmarkRepository.create(data);

    if (!bookmark) throw new ConflictError(BOOKMARK_ALREADY_EXISTS);

    this.logger.log(`Bookmark created: ${bookmark.id}`);
    this.eventBus.emit(BOOKMARK_CREATED_EVENT, { bookmarkId: bookmark.id });

    return bookmark;
  }

  public async findByIdOrThrow(id: string, userId: string): Promise<BookmarkInterface> {
    return this.findOwnedOrThrow(id, userId);
  }

  public async findMany(
    userId: string,
    pagination: CursorPaginationInterface,
  ): Promise<BookmarkListInterface> {
    const items: BookmarkInterface[] = await this.bookmarkRepository.findManyAfter(
      userId,
      pagination,
    );
    const lastItem: BookmarkInterface | undefined = items[items.length - 1];
    const nextCursor: string | null =
      items.length === pagination.limit && lastItem ? lastItem.id : null;

    return { items, nextCursor };
  }

  public async update(
    id: string,
    userId: string,
    data: UpdateBookmarkDataType,
  ): Promise<BookmarkInterface> {
    await this.findOwnedOrThrow(id, userId);

    const bookmark: BookmarkInterface | null = await this.bookmarkRepository.update(id, data);

    if (!bookmark) throw new NotFoundError(BOOKMARK_NOT_FOUND);

    this.logger.log(`Bookmark updated: ${id}`);

    return bookmark;
  }

  public async deleteById(id: string, userId: string): Promise<void> {
    await this.findOwnedOrThrow(id, userId);

    const isDeleted: boolean = await this.bookmarkRepository.deleteById(id);

    if (!isDeleted) throw new NotFoundError(BOOKMARK_NOT_FOUND);

    this.logger.log(`Bookmark deleted: ${id}`);
  }

  // 404 for a missing bookmark, 403 for someone else's — existence is not
  // leaked the other way around because ids are not guessable (UUIDv7).
  private async findOwnedOrThrow(id: string, userId: string): Promise<BookmarkInterface> {
    const bookmark: BookmarkInterface | null = await this.bookmarkRepository.findById(id);

    if (!bookmark) throw new NotFoundError(BOOKMARK_NOT_FOUND);

    if (bookmark.userId !== userId) throw new ForbiddenError(BOOKMARK_ACCESS_DENIED);

    return bookmark;
  }
}
```

What is worth copying from this file:

- **Every local variable has an explicit type**, including
  `const nextCursor: string | null`. That is not decoration: when the right-hand
  side changes shape, the annotation fails at the assignment instead of three
  layers away.
- **The service throws meaning, not transport.** `ConflictError`, `NotFoundError`,
  `ForbiddenError` are domain errors carrying a category. The HTTP
  `AllExceptionsFilter` owns the only category→status map and renders
  `{ statusCode, code, details, timestamp, path }`. A `NotFoundException` from
  `@nestjs/common` in here would hard-wire the service to HTTP and is a review
  rejection.
- **The 404-vs-403 split is a security decision, written down.** Ownership
  failures return 403 because the id was already unguessable; had ids been
  sequential, 404 for both would have been the right call. Say which you chose
  and why, in a comment, at the branch.
- **`findOwnedOrThrow` runs before every write.** Existence and ownership checks
  belong to the service. Controllers never pre-check, cast, or compensate.
- **The logger is a class field**, never constructor-injected, and logs ids —
  never whole objects, never secrets.
- **Nothing in this file knows what a database is.** Search it for `prisma`: no
  hits. That is the test that matters.

The event name is a one-line addition to the core `event` module — feature
modules never import each other, so anything that wants to react to a bookmark
being created subscribes to this name instead:

```typescript
// apps/api/src/modules/event/constants/event-names.constants.ts
export const BOOKMARK_CREATED_EVENT = 'bookmark.created'; // <module:bookmark>
```

## 9. DTOs

Request DTO. Decorator order per field is **Swagger → class-validator →
`@Type()`**, and the class `implements` the shared wire interface — that
`implements` is the entire drift check between the API and both frontends.

```typescript
// apps/api/src/modules/bookmark/dtos/create-bookmark.dto.ts
import type { CreateBookmarkRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateBookmarkDto implements CreateBookmarkRequestInterface {
  @ApiProperty({ type: String, example: 'https://example.com/article', maxLength: 2048 })
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  readonly url: string;

  @ApiProperty({ type: String, example: 'An article worth re-reading', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  readonly title: string;

  @ApiPropertyOptional({ type: Boolean, example: false })
  @IsOptional()
  @IsBoolean()
  readonly isFavorite?: boolean | undefined;
}
```

`@MaxLength(2048)` mirrors `@db.VarChar(2048)` on purpose. A validator that is
looser than the column turns a user's typo into a 500 from Postgres.

Update DTO — composition, never a hand-copied field list:

```typescript
// apps/api/src/modules/bookmark/dtos/update-bookmark.dto.ts
import { CreateBookmarkDto } from '@modules/bookmark/dtos/create-bookmark.dto.js';
import type { UpdateBookmarkRequestInterface } from '@nest-aws-starter/shared';
import { OmitType, PartialType } from '@nestjs/swagger';

// Composition, never a hand-copied field list. `url` is omitted because it is
// the bookmark's identity — see the shared contract for the reasoning.
export class UpdateBookmarkDto
  extends PartialType(OmitType(CreateBookmarkDto, ['url'] as const))
  implements UpdateBookmarkRequestInterface {}
```

`PartialType`/`PickType`/`OmitType` come from `@nestjs/swagger`, not
`@nestjs/mapped-types` — the Swagger versions carry the `@ApiProperty` metadata
through, so the generated docs stay correct. The global `ValidationPipe` runs
with `whitelist: true`, so a client that sends `url` in a PATCH has it silently
stripped rather than applied.

Response DTO — `@Exclude()` at class level, `@Expose()` per visible field. An
allowlist, never a blocklist: a column added to the model later is invisible
until somebody deliberately exposes it.

```typescript
// apps/api/src/modules/bookmark/dtos/responses/bookmark-response.dto.ts
import type { BookmarkResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

// The wire tells the truth: dates cross HTTP as ISO-8601 strings, so the DTO
// implements the shared wire contract, not the Date-carrying domain interface.
// `userId` is absent on purpose — the caller is the owner by construction.
@Exclude()
export class BookmarkResponseDto implements BookmarkResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'https://example.com/article' })
  @Expose()
  readonly url: string;

  @ApiProperty({ type: String, example: 'An article worth re-reading' })
  @Expose()
  readonly title: string;

  @ApiProperty({ type: Boolean, example: false })
  @Expose()
  readonly isFavorite: boolean;

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly createdAt: string;

  @ApiProperty({ type: String, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Transform(({ value }: { value: Date }): string => value.toISOString())
  readonly updatedAt: string;
}
```

This DTO is the seam where domain becomes wire: it implements
`BookmarkResponseInterface` (strings, no `userId`) while the service handed it a
`BookmarkInterface` (`Date`s, `userId`). The `@Transform` is where the conversion
happens, and `implements` is what proves it landed on the right shape. Nullable
dates use `value?.toISOString() ?? null`.

```typescript
// apps/api/src/modules/bookmark/dtos/responses/bookmark-list-response.dto.ts
import { BookmarkResponseDto } from '@modules/bookmark/dtos/responses/bookmark-response.dto.js';
import type { BookmarkListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class BookmarkListResponseDto implements BookmarkListResponseInterface {
  @ApiProperty({ type: [BookmarkResponseDto] })
  @Expose()
  @Type(() => BookmarkResponseDto)
  readonly items: BookmarkResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly nextCursor: string | null;
}
```

`@Type(() => BookmarkResponseDto)` is required, not optional: without it
`class-transformer` never descends into the array and the nested allowlist does
not apply — every field of every item ships.

## 10. Entity and permissions

The entity is the CASL subject: a class CASL can use as ability metadata. It
carries no decorators because nothing serialises through it — `declare` fields
give the shape without emitting properties.

```typescript
// apps/api/src/modules/bookmark/entities/bookmark.entity.ts
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';

// CASL subject class — the ability metadata target for bookmark permissions.
export class BookmarkEntity implements BookmarkInterface {
  declare readonly id: string;
  declare readonly userId: string;
  declare readonly url: string;
  declare readonly title: string;
  declare readonly isFavorite: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
```

```typescript
// apps/api/src/modules/bookmark/permissions/bookmark.permissions.ts
import { BookmarkEntity } from '@modules/bookmark/entities/bookmark.entity.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

// Role-level gate only. Per-row ownership is the service's job
// (`findOwnedOrThrow`), because CASL sees the request, not the stored row.
export const bookmarkPermissions: PermissionsType = {
  [UserRoleEnum.USER]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, BookmarkEntity);
  },
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, BookmarkEntity);
  },
};
```

Roles come from `UserRoleEnum` in `packages/shared` — never from the generated
Prisma enums. Note the division of labour, because getting it wrong is the most
common way an ownership check ends up not running: **CASL answers "may a USER
touch bookmarks at all?"**, at the route, before any row is loaded. **The service
answers "is this particular row yours?"**, after loading it. A `can(..., { userId:
user.id })` condition here would only constrain objects CASL is handed — it does
not reach into the repository.

## 11. Module wiring

```typescript
// apps/api/src/modules/bookmark/bookmark.module.ts
import { BOOKMARK_REPOSITORY } from '@modules/bookmark/constants/bookmark.constants.js';
import { BookmarkController } from '@modules/bookmark/controllers/bookmark.controller.js';
import { bookmarkPermissions } from '@modules/bookmark/permissions/bookmark.permissions.js';
import { BookmarkPrismaRepository } from '@modules/bookmark/repositories/bookmark-prisma.repository.js';
import { BookmarkService } from '@modules/bookmark/services/bookmark.service.js';
import { CaslModule } from '@modules/casl/casl.module.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: bookmarkPermissions })],
  controllers: [BookmarkController],
  providers: [
    BookmarkService,
    { provide: BOOKMARK_REPOSITORY, useClass: BookmarkPrismaRepository },
  ],
  exports: [BookmarkService],
})
export class BookmarkModule {}
```

`exports: [BookmarkService]` — services only, always. The repository, the token
and the implementation are module-private; another module that needs bookmark
data asks the service or listens for `bookmark.created`. The `useClass` line is
the single line a database swap touches.

Register it in `apps/api/src/app.module.ts` — one import, one entry in `imports`,
both fenced:

```typescript
import { BookmarkModule } from '@modules/bookmark/bookmark.module.js'; // <module:bookmark>
```

```typescript
    BookmarkModule, // <module:bookmark>
```

## 12. The controller — the perfect endpoint

`ThrottlerBehindProxyGuard` and `JwtAuthGuard` are global (`APP_GUARD`), so a
controller adds only `AccessGuard`, per-route `@Throttle()` overrides, and
`@Public()` opt-outs.

```typescript
// apps/api/src/modules/bookmark/controllers/bookmark.controller.ts
import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { CreateBookmarkDto } from '@modules/bookmark/dtos/create-bookmark.dto.js';
import { BookmarkListResponseDto } from '@modules/bookmark/dtos/responses/bookmark-list-response.dto.js';
import { BookmarkResponseDto } from '@modules/bookmark/dtos/responses/bookmark-response.dto.js';
import { UpdateBookmarkDto } from '@modules/bookmark/dtos/update-bookmark.dto.js';
import { BookmarkEntity } from '@modules/bookmark/entities/bookmark.entity.js';
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';
import type { BookmarkListInterface } from '@modules/bookmark/interfaces/bookmark-list.interface.js';
import { BookmarkService } from '@modules/bookmark/services/bookmark.service.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StatusCodes } from 'http-status-codes';

@ApiBearerAuth()
@ApiTags('Bookmarks')
@UseGuards(AccessGuard)
@Controller('bookmarks')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: BookmarkResponseDto })
  @Serialize(BookmarkResponseDto)
  @UseAbility(ActionsEnum.CREATE, BookmarkEntity)
  @Post()
  public create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateBookmarkDto,
  ): Promise<BookmarkInterface> {
    return this.bookmarkService.create({ ...dto, userId });
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: BookmarkListResponseDto })
  @Serialize(BookmarkListResponseDto)
  @UseAbility(ActionsEnum.READ, BookmarkEntity)
  @Get()
  public findMany(
    @CurrentUserId() userId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<BookmarkListInterface> {
    return this.bookmarkService.findMany(userId, query);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: BookmarkResponseDto })
  @Serialize(BookmarkResponseDto)
  @UseAbility(ActionsEnum.READ, BookmarkEntity)
  @Get(':id')
  public findById(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookmarkInterface> {
    return this.bookmarkService.findByIdOrThrow(id, userId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: BookmarkResponseDto })
  @Serialize(BookmarkResponseDto)
  @UseAbility(ActionsEnum.UPDATE, BookmarkEntity)
  @Patch(':id')
  public update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookmarkDto,
  ): Promise<BookmarkInterface> {
    return this.bookmarkService.update(id, userId, dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.DELETE, BookmarkEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public deleteById(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.bookmarkService.deleteById(id, userId);
  }
}
```

Walk the checklist against every method above — no exceptions, ever:

- [x] **Auth** — `JwtAuthGuard` globally, `AccessGuard` on the class. A public
      route needs an explicit `@Public()` *and* a comment saying why.
- [x] **Permission** — `@UseAbility(action, BookmarkEntity)` on each route.
- [x] **Throttling** — global; `@Throttle()` overridden on `create` because it
      writes. Login, password reset and contact-form endpoints get tighter ones.
- [x] **`@ApiDefaultResponse`** with the exact response type, which also documents
      the shared error envelope.
- [x] **`@Serialize`** on every non-void response — this is what activates the
      response DTO's allowlist. Forget it and the raw domain object ships,
      `userId` and all.
- [x] **Piped params** — `ParseUUIDPipe`, never a raw string reaching a query.
- [x] **Decorator order** — Swagger → Serialize → ability → HTTP verb last.

And the negative test: there is not one `if` in this file. The controller
translates HTTP to a service call and nothing else. `userId` comes from
`@CurrentUserId()` (the verified token), never from the body — that spread order,
`{ ...dto, userId }`, matters.

## 13. Unit test

Unit tests mock the repository **at the contract**, never at Prisma. That is what
makes them fast, deterministic, and still meaningful: they exercise exactly the
layer that holds the business rules.

```typescript
// apps/api/src/modules/bookmark/tests/bookmark.service.spec.ts
import type { BookmarkInterface } from '@modules/bookmark/interfaces/bookmark.interface.js';
import type { BookmarkRepositoryInterface } from '@modules/bookmark/interfaces/bookmark-repository.interface.js';
import { BookmarkService } from '@modules/bookmark/services/bookmark.service.js';
import { ConflictError } from '@modules/common/errors/conflict.error.js';
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import type { EventBusService } from '@modules/event/services/event-bus.service.js';
import { describe, expect, it, vi } from 'vitest';

const ownerId = '01890a5d-0000-774b-bcce-b30209990001';

const bookmark: BookmarkInterface = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  userId: ownerId,
  url: 'https://example.com/article',
  title: 'An article worth re-reading',
  isFavorite: false,
  createdAt: new Date('2026-08-02T12:00:00Z'),
  updatedAt: new Date('2026-08-02T12:00:00Z'),
};

interface TestSetupInterface {
  readonly service: BookmarkService;
  readonly repository: BookmarkRepositoryInterface;
  readonly emit: ReturnType<typeof vi.fn>;
}

function createService(overrides: Partial<BookmarkRepositoryInterface> = {}): TestSetupInterface {
  const repository: BookmarkRepositoryInterface = {
    create: vi.fn().mockResolvedValue(bookmark),
    findById: vi.fn().mockResolvedValue(bookmark),
    findManyAfter: vi.fn().mockResolvedValue([bookmark]),
    update: vi.fn().mockResolvedValue(bookmark),
    deleteById: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  const emit = vi.fn();
  const eventBus = { emit } as unknown as EventBusService;
  const service: BookmarkService = new BookmarkService(repository, eventBus);

  return { service, repository, emit };
}

describe('BookmarkService', () => {
  it('creates a bookmark and emits bookmark.created', async () => {
    const { service, emit } = createService();

    const created: BookmarkInterface = await service.create({
      userId: ownerId,
      url: bookmark.url,
      title: bookmark.title,
    });

    expect(created).toEqual(bookmark);
    expect(emit).toHaveBeenCalledWith('bookmark.created', { bookmarkId: bookmark.id });
  });

  it('maps a unique-constraint hit to the coded conflict error', async () => {
    const { service, emit } = createService({ create: vi.fn().mockResolvedValue(null) });

    try {
      await service.create({ userId: ownerId, url: bookmark.url, title: bookmark.title });
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(ConflictError);
      expect((caught as ConflictError).args.code).toBe('BOOKMARK_ALREADY_EXISTS');
    }

    expect(emit).not.toHaveBeenCalled();
  });

  it('throws the coded not-found error for a missing id', async () => {
    const { service } = createService({ findById: vi.fn().mockResolvedValue(null) });

    try {
      await service.findByIdOrThrow('missing-id', ownerId);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('BOOKMARK_NOT_FOUND');
    }
  });

  it('denies reading, updating and deleting a foreign bookmark', async () => {
    const { service, repository } = createService();
    const strangerId = '01890a5d-0000-774b-bcce-b30209990002';

    for (const attempt of [
      (): Promise<unknown> => service.findByIdOrThrow(bookmark.id, strangerId),
      (): Promise<unknown> => service.update(bookmark.id, strangerId, { title: 'hijack' }),
      (): Promise<unknown> => service.deleteById(bookmark.id, strangerId),
    ]) {
      const caught: unknown = await attempt()
        .then(() => null)
        .catch((error: unknown): unknown => error);

      expect(caught).toBeInstanceOf(ForbiddenError);
      expect((caught as ForbiddenError).args.code).toBe('BOOKMARK_ACCESS_DENIED');
    }

    expect(repository.update).not.toHaveBeenCalled();
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it('maps a concurrent delete to the domain 404 instead of a 500', async () => {
    const { service } = createService({ deleteById: vi.fn().mockResolvedValue(false) });

    try {
      await service.deleteById(bookmark.id, ownerId);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(NotFoundError);
      expect((caught as NotFoundError).args.code).toBe('BOOKMARK_NOT_FOUND');
    }
  });

  it('maps an update of a vanished bookmark to the domain 404', async () => {
    const { service } = createService({ update: vi.fn().mockResolvedValue(null) });

    await expect(
      service.update(bookmark.id, ownerId, { title: 'late update' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('scopes the list to the owner and pages by cursor', async () => {
    const second: BookmarkInterface = { ...bookmark, id: '01890a5d-ac96-774b-bcce-b302099a9999' };
    const findManyAfter = vi.fn().mockResolvedValue([bookmark, second]);
    const { service } = createService({ findManyAfter });

    const fullPage = await service.findMany(ownerId, { cursor: null, limit: 2 });

    expect(findManyAfter).toHaveBeenCalledWith(ownerId, { cursor: null, limit: 2 });
    expect(fullPage.items).toHaveLength(2);
    expect(fullPage.nextCursor).toBe(second.id);

    const { service: shortService } = createService({
      findManyAfter: vi.fn().mockResolvedValue([bookmark]),
    });
    const shortPage = await shortService.findMany(ownerId, { cursor: null, limit: 2 });

    expect(shortPage.nextCursor).toBeNull();
  });
});
```

Because the mock is typed `BookmarkRepositoryInterface`, adding a method to the
contract breaks this file until the mock grows it — the test suite is a second
consumer keeping the contract honest. Note that the assertions check the error
**code**, not the message: the code is the contract, the message is prose.

## 14. E2E test

E2E specs live in **`apps/api/test/`**, not inside the module folder — they boot
the whole app and run against real Postgres, Redis and LocalStack, so they are
app-level, not module-level. Everything else about the module stays inside
`apps/api/src/modules/bookmark/`.

Per endpoint the bar is: happy path, 401 unauthenticated, 403 forbidden, 404
missing, and a validation 400 asserting the exact error `code`.

```typescript
// apps/api/test/bookmark.e2e-spec.ts
import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

interface BookmarkBodyInterface {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly isFavorite: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

describe('bookmarks', () => {
  let app: NestFastifyApplication;
  let ownerToken: string;
  let strangerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await registerUser();
    strangerToken = await registerUser();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueIp(): string {
    return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  function uniqueUrl(): string {
    return `https://example.com/${randomUUID()}`;
  }

  async function registerUser(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', uniqueIp())
      .send({
        displayName: 'Bookmark E2E',
        email: `bookmark-e2e-${randomUUID()}@example.com`,
        password: 'correct-horse-battery',
      })
      .expect(201);

    return response.body.accessToken;
  }

  async function createBookmark(
    url: string,
    token: string = ownerToken,
  ): Promise<BookmarkBodyInterface> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookmarks')
      .set('authorization', `Bearer ${token}`)
      .set('x-forwarded-for', uniqueIp())
      .send({ url, title: 'An article worth re-reading' })
      .expect(201);

    return response.body as BookmarkBodyInterface;
  }

  it('rejects every route without a token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bookmarks')
      .send({ url: uniqueUrl(), title: 'nope' })
      .expect(401);
    await request(app.getHttpServer()).get('/api/v1/bookmarks').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/bookmarks/01890a5d-ac96-774b-bcce-b30209000000')
      .expect(401);
  });

  it('creates a bookmark and serializes only exposed fields', async () => {
    const url: string = uniqueUrl();
    const bookmark: BookmarkBodyInterface = await createBookmark(url);

    expect(bookmark.url).toBe(url);
    expect(bookmark.isFavorite).toBe(false);
    expect(Object.keys(bookmark).sort()).toEqual([
      'createdAt',
      'id',
      'isFavorite',
      'title',
      'updatedAt',
      'url',
    ]);
  });

  it('rejects a non-URL with the coded envelope', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookmarks')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-forwarded-for', uniqueIp())
      .send({ url: 'not-a-url', title: 'bad input' })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(typeof response.body.code).toBe('string');
    expect(response.body.details).toContain('url');
  });

  it('returns the coded conflict when the same owner re-bookmarks a URL', async () => {
    const url: string = uniqueUrl();

    await createBookmark(url);

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookmarks')
      .set('authorization', `Bearer ${ownerToken}`)
      .set('x-forwarded-for', uniqueIp())
      .send({ url, title: 'duplicate' })
      .expect(409);

    expect(response.body.code).toBe('BOOKMARK_ALREADY_EXISTS');
  });

  it('lets a different user bookmark the same URL', async () => {
    const url: string = uniqueUrl();

    await createBookmark(url);
    const foreign: BookmarkBodyInterface = await createBookmark(url, strangerToken);

    expect(foreign.url).toBe(url);
  });

  it('hides foreign bookmarks from reads, updates and deletes with 403', async () => {
    const bookmark: BookmarkBodyInterface = await createBookmark(uniqueUrl());

    const read = await request(app.getHttpServer())
      .get(`/api/v1/bookmarks/${bookmark.id}`)
      .set('authorization', `Bearer ${strangerToken}`)
      .expect(403);

    expect(read.body.code).toBe('BOOKMARK_ACCESS_DENIED');

    await request(app.getHttpServer())
      .patch(`/api/v1/bookmarks/${bookmark.id}`)
      .set('authorization', `Bearer ${strangerToken}`)
      .send({ title: 'hijack' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/bookmarks/${bookmark.id}`)
      .set('authorization', `Bearer ${strangerToken}`)
      .expect(403);
  });

  it('scopes the list to the requesting user', async () => {
    const own: BookmarkBodyInterface = await createBookmark(uniqueUrl());
    const foreign: BookmarkBodyInterface = await createBookmark(uniqueUrl(), strangerToken);

    const seen: Set<string> = new Set();
    let cursor: string | null = null;

    for (let page = 0; page < 50; page += 1) {
      const query: string = cursor ? `?limit=2&cursor=${cursor}` : '?limit=2';
      const response = await request(app.getHttpServer())
        .get(`/api/v1/bookmarks${query}`)
        .set('authorization', `Bearer ${ownerToken}`)
        .expect(200);

      for (const item of response.body.items as BookmarkBodyInterface[]) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }

      cursor = response.body.nextCursor;

      if (cursor === null) break;
    }

    expect(seen.has(own.id)).toBe(true);
    expect(seen.has(foreign.id)).toBe(false);
  });

  it('returns the coded not-found envelope for a missing id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/bookmarks/01890a5d-ac96-774b-bcce-b30209000000')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(response.body.code).toBe('BOOKMARK_NOT_FOUND');
  });

  it('updates a bookmark and ignores an attempt to repoint its url', async () => {
    const url: string = uniqueUrl();
    const bookmark: BookmarkBodyInterface = await createBookmark(url);

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/bookmarks/${bookmark.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .send({ title: 'updated title', isFavorite: true, url: uniqueUrl() })
      .expect(200);

    expect(response.body.title).toBe('updated title');
    expect(response.body.isFavorite).toBe(true);
    expect(response.body.url).toBe(url);
  });

  it('deletes a bookmark and then returns 404 for it', async () => {
    const bookmark: BookmarkBodyInterface = await createBookmark(uniqueUrl());

    await request(app.getHttpServer())
      .delete(`/api/v1/bookmarks/${bookmark.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(204);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/bookmarks/${bookmark.id}`)
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(404);

    expect(response.body.code).toBe('BOOKMARK_NOT_FOUND');
  });
});
```

Two habits worth stealing, because both come from suites that used to flake:

- **`uniqueIp()` on every request that counts against a rate limit.** The
  throttler keys on client ip and the suite shares one; without it a spec fails
  only when run after enough siblings, which is the worst kind of failure.
- **`uniqueUrl()` per test.** The e2e database is not reset between runs, so any
  spec that relies on a fixed unique value passes exactly once. The
  `Object.keys(...).sort()` assertion is the other half of the serialization
  check — it fails loudly if `userId` ever starts shipping.

## 15. Making the module removable

Every optional module in this repository can be deleted, and
`scripts/subtraction-test.mjs` proves it in CI by actually doing so in a
throwaway worktree and rebuilding what is left. Earning that costs two things.

**Fence markers on every cross-module reference.** A line that mentions
`bookmark` from a file that survives the deletion carries a trailing
`// <module:bookmark>`; a whole block sits between own-line
`// <module:bookmark>` and `// </module:bookmark>` markers. We have already
written all of them:

| File | What is fenced |
|---|---|
| `apps/api/src/app.module.ts` | the import line and the `imports` entry |
| `apps/api/src/modules/event/constants/event-names.constants.ts` | `BOOKMARK_CREATED_EVENT` |
| `apps/api/prisma/schema.prisma` | the `User.bookmarks` relation line, and the `model Bookmark` block |
| `packages/shared/src/index.ts` | the six `export *` lines |

Inside JSX the same markers are written `{/* <module:bookmark> */}`, because a
`//` comment is a syntax error among JSX children.

**An entry in the script's `MODULES` array**, listing the paths a removal deletes
wholesale. Add it after the `note` entry in `scripts/subtraction-test.mjs`:

```javascript
  {
    id: 'bookmark',
    summary: 'Saved-URL bookmarks CRUD — the worked example in docs/guides/adding-a-module.md.',
    paths: [
      'apps/api/src/modules/bookmark',
      'apps/api/test/bookmark.e2e-spec.ts',
      'packages/shared/src/bookmarks',
    ],
    envVars: [],
    frontendFenced: true,
    manualSteps: [],
    cosmeticSteps: [
      ['apps/web, apps/admin', 'nothing — this module has no frontend surface at all'],
    ],
  },
```

`frontendFenced: true` is an assertion, not a preference: it switches on
`tsc --noEmit` plus the unit suites for `apps/web` and `apps/admin` in the
subtracted worktree, and the script refuses to run if the entry still claims a
hand-edit under `apps/web`, `apps/admin` or `packages/shared`. Claim it only when
`manualSteps` is genuinely empty. If your module *does* have a frontend surface,
its pages, hooks, apis and specs go in `paths`, and the lines that mount them
(routes, nav entries) get JSX fences.

Then regenerate the removal recipes:

```bash
node scripts/subtraction-test.mjs --emit-docs
```

This writes `docs/removal/bookmark.md` from your entry plus the fence markers it
finds — never hand-edit those files. It also rewrites the *other* recipes, because
they quote line numbers and your new fences shifted them. Commit the whole
`docs/removal/` diff; it is noise, but it is the kind of noise that keeps the
recipes true.

One trap: **the subtraction test operates on `HEAD`.** It creates its worktree
from the last commit, so a module that exists only in your working tree is
invisible to it and the run will pass without testing anything. Commit first,
then run:

```bash
node scripts/subtraction-test.mjs --module bookmark
```

```
=== bookmark ===
  ok  install
  ok  build shared
  ok  copy generated prisma client
  ok  tsc --noEmit
  ok  tsc --noEmit (e2e suite)
  ok  unit tests
  ok  apps/web tsc --noEmit
  ok  apps/web unit tests
  ok  apps/admin tsc --noEmit
  ok  apps/admin unit tests
PASS  bookmark
```

## 16. Run the gate

```bash
pnpm run lint
pnpm run build
pnpm run test
pnpm --dir apps/api run test:e2e
node scripts/subtraction-test.mjs
```

`pnpm run lint` runs Biome's `check`, which includes the **formatter**. Biome
formats to a 100-character line width and will happily collapse a generic you
wrapped by hand — a perfectly readable
`Partial<\n  Omit<CreateBookmarkDataInterface, 'userId' | 'url'>\n>` is a lint
failure. Do not fight it:

```bash
pnpm run format
```

`pnpm run build` runs `prisma generate --sql` and then type-checks all four
workspaces. If `this.prisma.bookmark` is a type error, the client is stale —
`pnpm --dir apps/api run db:generate` fixes it.

## 17. The commit series

One logical unit per commit, conventional subject lines, no body. The contract
goes first so the history shows what it was at every point:

```
feat(shared): add the bookmark wire contracts
feat(api): add the bookmark prisma model and migration
feat(api): add the bookmark repository contract and prisma implementation
feat(api): add the bookmark service with coded ownership and conflict errors
feat(api): expose the bookmark crud endpoints
test(api): cover the bookmark service and endpoints
chore: register bookmark with the subtraction test
```

A PR that needs "and" in its title is two PRs.
[`CONTRIBUTING.md`](../../CONTRIBUTING.md) has the branch model and the rest of
the workflow.

## 18. Deleting it again

Because the module is fenced, removing it is mechanical. Follow
`docs/removal/bookmark.md`, or let the script show you exactly what it strips:

```bash
node scripts/subtraction-test.mjs --module bookmark
```

The one part no script can decide for you is the database, and the generated
recipe says so: Prisma migrations are append-only, so editing the schema does not
drop a table that already exists. Either delete `apps/api/prisma/migrations/`
and re-baseline (fine before any deploy), or add a `drop_bookmark` migration and
read its SQL before it runs anywhere real.

---

You have now touched every convention in this repository.
