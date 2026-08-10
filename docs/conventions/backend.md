# Backend Conventions

NestJS — TypeScript — Prisma — PostgreSQL — Redis — Zod

These rules are binding. Every module in `apps/api` follows them; the shipped `note`
module is the living reference implementation. When in doubt, imitate the sample module.

**Scope.** This file covers `apps/api` only. Its two siblings cover the rest of the
repository, and a change that crosses the HTTP boundary is governed by all three:

- [`frontend.md`](./frontend.md) — `apps/web` and `apps/admin`: layers, `apiClient`,
  stores, the notification socket, theming, accessibility, Testing Library.
- [`shared-contracts.md`](./shared-contracts.md) — `packages/shared`: what may be
  shared, ISO date strings, integer money, the `implements` drift check, and why a
  contract change is a breaking change for two consumers at once.

Workflow rather than code — branch model, commit and PR shape, the local and CI
gate — lives in [`CONTRIBUTING.md`](../../CONTRIBUTING.md), which is its only home.

---

## 1. The golden rule: depend on contracts, never on implementations

Layers and features communicate exclusively through interfaces (contracts). The
database, the ORM, every external system is an implementation detail hidden behind a
contract. The proof test for every design decision:

> **Could we swap Prisma/PostgreSQL for Mongoose/MongoDB by writing new repository
> implementations only — touching zero services, zero controllers, zero contracts?**

If the answer is ever "no", the code is wrong.

```
Controller  →  Service  →  RepositoryInterface  ←implements←  PrismaRepository
   HTTP         business        contract                       database detail
```

| Layer | Owns | Never contains |
|---|---|---|
| Controller | HTTP: routes, DTO validation, Swagger, guards, serialization | Business logic, repository access, DB knowledge |
| Service | All business logic, orchestration, events, errors | HTTP concepts, DB/ORM types, query syntax |
| Repository | DB access, mapping rows → domain interfaces | Business logic, HTTP concepts, knowledge of services |

**Dependency direction and visibility:**

- Services depend on **repository contracts** (`NoteRepositoryInterface`) via injection
  tokens — never on concrete repository classes.
- Repositories know nothing about services, controllers, or each other.
- Modules **export services only**. Repositories, tokens, and implementations are
  module-private. If another module needs data, it asks the service (or listens to an
  event) — never the repository.
- The generated Prisma client (`@generated/prisma/client.js`, `.../models.js`,
  `.../enums.js`, `.../sql.js`) may be imported only inside `*-prisma.repository.ts`
  files, their unit specs, and Prisma infrastructure (`PrismaService`). Anywhere else
  it is a review rejection — no lint rule encodes this one.
- Repository methods accept scalars/domain inputs and return domain interfaces —
  never ORM models, never ORM generics, never query fragments.
- Repositories expose named, intention-revealing methods (`findActiveByUserId`), not
  query pass-throughs. A new query shape = a new named method on the contract.

```
✅ noteRepository.findManyByUserId(userId, pagination): Promise<NoteInterface[]>
❌ noteRepository.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
```

## 2. TypeScript: interfaces first

**Objects are interfaces.** Anything with a shape — domain models, method inputs,
config shapes, event payloads, provider contracts — is an `interface`. `type` is
reserved for what an interface cannot express: unions, intersections, mapped/utility
compositions, primitive aliases.

| Construct | Keyword | Folder | Suffix |
|---|---|---|---|
| Any object shape / contract | `interface` | `interfaces/` | `.interface.ts` |
| Unions, intersections, utility compositions | `type` | `types/` | `.type.ts` |
| API response classes | `class` | `entities/` or `dtos/responses/` | `.entity.ts` / `.dto.ts` |
| Request validation classes | `class` | `dtos/` | `.dto.ts` |

### One declaration = one file (no exceptions for providers)

- One export per file in `interfaces/`, `types/`, `enums/` — never two interfaces,
  two types, or a mixed bag in one file.
- No interface, type, or enum is ever declared inside a service, controller,
  repository, guard, interceptor, or **provider** file — not at the top, not at the
  bottom. Every declaration lives in its dedicated file under the owning module's
  `interfaces/`, `types/`, or `enums/` folder (providers keep theirs inside their own
  provider folder: `providers/s3/interfaces/upload-file-data.interface.ts`).
- Why: dedicated files are droppable — removing a feature deletes files, it never
  edits shared ones; imports show exactly who depends on what; git history stays
  attributable.
- The single sanctioned exception: a config file exports its Zod schema-inferred
  `XConfig` type next to `registerAs` — the type is generated from the schema and
  inseparable from it.
- All properties in interfaces, DTOs, and entities are `readonly`.
- `any` is forbidden — `unknown` + narrowing.
- Explicit `public`/`private` on every method and property; explicit return type on
  every public method; explicit type annotation on every local variable.

### Variables — explicit type, always, even for primitives

```typescript
const isActive: boolean = note.status === NoteStatusEnum.ACTIVE;
const title: string = dto.title.trim();
const retryCount: number = 0;
const noteIds: string[] = notes.map((note: NoteInterface): string => note.id);
const note: NoteInterface | null = await this.noteRepository.findById(id);
const createdNotes: NoteInterface[] = await this.noteRepository.createMany(data);
```

No inferred locals. If the right-hand side changes shape, the annotation catches it
at the assignment, not three layers away.

### Interface — every object shape, every property `readonly`

```typescript
// interfaces/note.interface.ts
import { NoteStatusEnum } from '@nest-aws-starter/shared';

export interface NoteInterface {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatusEnum;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

`NoteStatusEnum` travels on the wire, so it lives in `packages/shared` and is imported
from there — see §12 and [`shared-contracts.md`](./shared-contracts.md).

```typescript
// interfaces/note-created-payload.interface.ts  (event payloads are interfaces too)
export interface NoteCreatedPayloadInterface {
  readonly noteId: string;
}
```

### Type — only what an interface cannot express

```typescript
// providers/redis/types/redis-client.type.ts — union of two classes
import type { Cluster, Redis } from 'ioredis';

export type RedisClientType = Redis | Cluster;
```

```typescript
// types/note-sort-field.type.ts — literal union
export type NoteSortFieldType = 'createdAt' | 'title' | 'status';
```

```typescript
// types/update-note-data.type.ts — utility composition (when derived, not authored)
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';

export type UpdateNoteDataType = Partial<CreateNoteDataInterface>;
```

If it has named properties you are writing by hand — it is an `interface`, full stop.

### Enum

```typescript
// modules/oauth/enums/oauth-intent.enum.ts
export enum OauthIntentEnum {
  LOGIN = 'login',
  LINK = 'link',
}
```

String-valued, PascalCase name with `Enum` suffix, one per file. A module's `enums/`
folder holds only enums that never leave the API; anything that travels on the wire
(`NoteStatusEnum`, `UserRoleEnum`) is declared in `packages/shared` instead — §12.

## 3. Size limits (enforced in review, no exceptions without a stated reason)

| Unit | Limit |
|---|---|
| Function/method | ≤ 25 lines, one responsibility, max 2 nesting levels |
| File | ≤ 300 lines — split before adding |
| Commit | One logical unit (a contract, a service, a migration) |
| PR | One concern; target ≤ ~400 changed lines. A PR that needs "and" in its title is two PRs |

Small is a feature. Long functions get extracted into named private methods; long
services get split into focused services within the module.

## 4. Module anatomy

**Every artifact kind lives in its dedicated folder — even when there is only one
file.** A module never has loose `*.controller.ts`/`*.service.ts` files at its root;
the only root file is `<name>.module.ts`. This keeps git history clean: adding a
second service never means moving the first one.

```
src/modules/note/
├── note.module.ts                        # the ONLY root-level file
├── controllers/
│   └── note.controller.ts
├── services/
│   └── note.service.ts
├── repositories/
│   └── note-prisma.repository.ts         # the ONLY Prisma zone
├── constants/
│   ├── note.constants.ts                 # injection tokens
│   └── note-errors.constants.ts          # this module's coded errors
├── interfaces/
│   ├── note.interface.ts                 # domain model
│   ├── note-repository.interface.ts      # repository contract
│   ├── create-note-data.interface.ts
│   └── note-list.interface.ts
├── types/
│   └── update-note-data.type.ts          # derived shape → `type`, not `interface`
├── dtos/
│   ├── create-note.dto.ts
│   ├── update-note.dto.ts
│   └── responses/
│       ├── note-response.dto.ts
│       └── note-list-response.dto.ts
├── entities/
│   └── note.entity.ts                    # CASL subject class
├── permissions/
│   └── note.permissions.ts               # CASL rules for this module
└── tests/
    └── note.service.spec.ts               # unit specs only
```

The sample module has no `enums/` folder: its only enum (`NoteStatusEnum`) travels on
the wire and therefore lives in `packages/shared` (§12). Add `enums/` when the module
gains an enum that stays inside the API.

E2E specs are the one artifact that does **not** live in the module: they boot the
whole app against real Postgres/Redis/LocalStack, so they sit together in
`apps/api/test/` (`apps/api/test/note.e2e-spec.ts`) under their own tsconfig and
vitest config.

Modules that own other artifact kinds add sibling folders under the same rule —
one kind per folder, even for a single file:

| Folder | Owns | Reference module |
|---|---|---|
| `gateways/` | WebSocket gateways — transport concerns only (handshake auth, room joins, revalidation), no domain logic, no repository access (§11b) | `notification` |
| `adapters/` | Transport adapters installed at bootstrap (e.g. the Redis-backed Socket.IO adapter and its disabled twin) (§11b) | `notification` |
| `builders/` | Pure event-payload → persisted-content mappers — no I/O, no DI (§11a) | `notification` |
| `listeners/` | `@OnDomainEvent` subscribers — contained handlers that never break the emitter (§11a) | `activity`, `user`, `account-security` |
| `templates/` | Mail/render templates — pure functions returning content shapes | `auth`, `account-security`, `notification` |
| `helpers/` | Module-owned free functions needed outside DI (e.g. bootstrap wiring) | `notification` |

Registered by exactly one line in `AppModule`. Feature modules never import other
feature modules — cross-feature communication goes through the event bus or core
modules (`user`, `auth`) and providers only. Nothing lints this: it holds by review,
and `scripts/subtraction-test.mjs` is the closest automated proxy — it deletes a
module inside its removal fences and checks the rest still builds.

## 5. Contract + token

```typescript
// constants/note.constants.ts
export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');
```

```typescript
// interfaces/note-repository.interface.ts
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { UpdateNoteDataType } from '@modules/note/types/update-note-data.type.js';

export interface NoteRepositoryInterface {
  create(data: CreateNoteDataInterface): Promise<NoteInterface>;
  findById(id: string): Promise<NoteInterface | null>;
  findManyAfter(userId: string, pagination: CursorPaginationInterface): Promise<NoteInterface[]>;
  update(id: string, data: UpdateNoteDataType): Promise<NoteInterface | null>;
  deleteById(id: string): Promise<boolean>;
}
```

Nothing in this contract knows a database exists. That is the point. Note the return
types: a missing row is `null`/`false`, not a thrown `NotFoundError` — the repository
reports facts and the service decides what they mean (§7).

## 6. Repository implementation (the only Prisma zone)

The Prisma client is generated into `apps/api/src/generated/prisma` and imported
through the `@generated/*` alias — never from the `@prisma/client` package path.
Models live in `@generated/prisma/models.js` (`NoteModel`), DB-level enums in
`@generated/prisma/enums.js` (`NoteStatus`), the namespace with the error classes in
`@generated/prisma/client.js` (`Prisma`), and TypedSQL functions in
`@generated/prisma/sql.js`.

```typescript
// repositories/note-prisma.repository.ts
import { Prisma } from '@generated/prisma/client.js';
import { NoteStatus } from '@generated/prisma/enums.js';
import type { NoteModel } from '@generated/prisma/models.js';
import type { CursorPaginationInterface } from '@interfaces/cursor-pagination.interface.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import { NoteStatusEnum } from '@nest-aws-starter/shared';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotePrismaRepository implements NoteRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateNoteDataInterface): Promise<NoteInterface> {
    const note: NoteModel = await this.prisma.note.create({
      data: {
        userId: data.userId,
        title: data.title,
        ...(data.body !== undefined && { body: data.body }),
        ...(data.status !== undefined && { status: this.toPrismaStatus(data.status) }),
      },
    });

    return this.toDomain(note);
  }

  public async findById(id: string): Promise<NoteInterface | null> {
    const note: NoteModel | null = await this.prisma.note.findUnique({ where: { id } });

    return note ? this.toDomain(note) : null;
  }

  public async deleteById(id: string): Promise<boolean> {
    try {
      await this.prisma.note.delete({ where: { id } });

      return true;
    } catch (caught) {
      if (this.isRecordNotFound(caught)) return false;

      throw caught;
    }
  }

  private isRecordNotFound(caught: unknown): boolean {
    return caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2025';
  }

  private toDomain(note: NoteModel): NoteInterface {
    return {
      id: note.id,
      userId: note.userId,
      title: note.title,
      body: note.body,
      status: NoteStatusEnum[note.status],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  private toPrismaStatus(status: NoteStatusEnum): NoteStatus {
    return NoteStatus[status];
  }
}
```

Prisma model types appear only here, only as local variable types, and the DB enum is
translated to the shared wire enum on the way out — a `NoteStatus` value never escapes
this file. A future `NoteMongooseRepository` implements the same contract in a sibling
file; the module binding is the only other line that changes.

The only Prisma error codes a repository may branch on are `P2025` (not-found
signal, e.g. `update`/`delete` on a missing row) and `P2002` (idempotent-replay
signal, e.g. a unique-constraint hit on a repeated create) — both confined to the
repository, never leaked as raw Prisma errors past its boundary.

### TypedSQL — the blessed pattern for hand-optimized queries

When the query builder is the wrong tool (aggregations, reports, window functions),
use Prisma TypedSQL — never string-built `$queryRaw`:

- The SQL lives in `prisma/sql/<name>.sql`; `prisma generate --sql` produces a fully
  typed function, exported from `@generated/prisma/sql.js`.
- TypedSQL functions are called **only inside repositories**, and their rows are
  mapped to domain interfaces like any other result — the contract never reveals
  that raw SQL exists.
- TypedSQL columns are nullable in the generated `Result` type; coalesce at the
  mapping boundary so the domain interface stays total.

The reference implementation is `StatisticTypedSqlRepository`:

```sql
-- prisma/sql/usersByStatus.sql
SELECT
  status::text AS status,
  COUNT(*)::int AS count
FROM users
GROUP BY status
ORDER BY status;
```

```typescript
// repositories/statistic-typed-sql.repository.ts
import { usersByStatus } from '@generated/prisma/sql.js';

public async findUsersByStatus(): Promise<StatisticsCountRowInterface[]> {
  const rows: usersByStatus.Result[] = await this.prisma.$queryRawTyped(usersByStatus());

  return rows.map(
    (row: usersByStatus.Result): StatisticsCountRowInterface => ({
      key: row.status ?? 'UNKNOWN',
      count: row.count ?? 0,
    }),
  );
}
```

### Pagination: cursor by default

Offset pagination (`OFFSET n`) scans and discards `n` rows — it degrades linearly
and is forbidden for public/high-volume endpoints. The standard is cursor-based:

```typescript
// modules/common/interfaces/cursor-pagination.interface.ts — the `@interfaces/*` alias
export interface CursorPaginationInterface {
  readonly cursor: string | null;   // id of the last item of the previous page
  readonly limit: number;
}
```

```typescript
public async findManyAfter(
  userId: string,
  pagination: CursorPaginationInterface,
): Promise<NoteInterface[]> {
  const notes: NoteModel[] = await this.prisma.note.findMany({
    where: { userId },
    take: pagination.limit,
    ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
    // UUIDv7 ids are time-ordered — id order IS creation order.
    orderBy: { id: 'desc' },
  });

  return notes.map((note: NoteModel): NoteInterface => this.toDomain(note));
}
```

**Filtered lists paginate by keyset, not by `cursor` + `skip: 1`.** That `skip: 1`
exists only to drop the cursor row itself, and it assumes the cursor row is still the
first row the query matches. The moment the `where` filters on state a row can leave
(read/unread, status), the assumption breaks: the filter has already excluded the
cursor row, so the offset eats the *next* legitimate row and the reader silently never
sees it. Put the comparison in the `where` instead — correct for every filter
combination, because it stops depending on the cursor row surviving:

```typescript
where: {
  ...filters,
  // `lt` pairs with `id: 'desc'` — UUIDv7 ids are time-ordered
  ...(pagination.cursor && { id: { lt: pagination.cursor } }),
},
take: pagination.limit,
orderBy: { id: 'desc' },
```

Offset pagination is allowed only for bounded admin tables (search + page numbers),
always with a hard `limit` cap.

**Every list is capped, including the ones with no `limit` parameter.**
`MAX_PAGE_SIZE` / `DEFAULT_PAGE_SIZE` (`@constants/pagination.constants.js`) are the
`@Max` and the default on both pagination DTOs. A list whose wire contract is a plain
array with no cursor — `/billing/plans`, `/sessions`, `/auth/methods`,
`/admin/account-security/lockouts` — still passes `take: MAX_PAGE_SIZE` in its repository:
"the table is small today" is a property of the data, not of the query, and
`/billing/plans` is public and unauthenticated. Never write a per-endpoint cap.

### Schema rules

- Primary keys: `String @id @default(uuid(7))` — UUIDv7, time-ordered.
- Every foreign key and every column used in a `where`/`orderBy` gets an explicit
  `@@index` in the same migration that introduces the query. "Prisma made the FK"
  is not an index.

## 7. Service (business logic only, the module's sole export)

```typescript
// services/note.service.ts
import { ForbiddenError } from '@modules/common/errors/forbidden.error.js';
import { NotFoundError } from '@modules/common/errors/not-found.error.js';
import { NOTE_CREATED_EVENT } from '@modules/event/constants/event-names.constants.js';
import { EventBusService } from '@modules/event/services/event-bus.service.js';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service.js';
import { NOTE_REPOSITORY } from '@modules/note/constants/note.constants.js';
import {
  NOTE_ACCESS_DENIED,
  NOTE_NOT_FOUND,
} from '@modules/note/constants/note-errors.constants.js';
import type { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface.js';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class NoteService {
  private readonly logger = new CustomLoggerService(NoteService.name);

  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: NoteRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async create(data: CreateNoteDataInterface): Promise<NoteInterface> {
    const note: NoteInterface = await this.noteRepository.create(data);

    this.logger.log(`Note created: ${note.id}`);
    this.eventBus.emit(NOTE_CREATED_EVENT, { noteId: note.id });

    return note;
  }

  public async deleteById(id: string, userId: string): Promise<void> {
    await this.findOwnedOrThrow(id, userId);

    const isDeleted: boolean = await this.noteRepository.deleteById(id);

    if (!isDeleted) throw new NotFoundError(NOTE_NOT_FOUND);

    this.logger.log(`Note deleted: ${id}`);
  }

  // 404 for a missing note, 403 for someone else's — existence is not leaked
  // the other way around because note ids are not guessable (UUIDv7).
  private async findOwnedOrThrow(id: string, userId: string): Promise<NoteInterface> {
    const note: NoteInterface | null = await this.noteRepository.findById(id);

    if (!note) throw new NotFoundError(NOTE_NOT_FOUND);

    if (note.userId !== userId) throw new ForbiddenError(NOTE_ACCESS_DENIED);

    return note;
  }
}
```

- Existence checks, ownership checks, throws — in the service. Controllers never
  pre-check, cast, or compensate.
- Services take **domain inputs**, not DTOs. The controller merges the validated DTO
  with the authenticated user id (`{ ...dto, userId }`) and hands over a
  `CreateNoteDataInterface`; the service never imports a DTO class.
- Event names are constants from the core `event` module, never inline strings.
- Logger is a class field, never constructor-injected.

## 8. Controller (the perfect endpoint)

Every endpoint carries the full stack — auth, permissions, throttling, Swagger,
serialization — and zero logic. `ThrottlerBehindProxyGuard` and `JwtAuthGuard`
run globally (`APP_GUARD`), so a controller only adds `AccessGuard`, per-route
`@Throttle()` overrides, and `@Public()` opt-outs:

```typescript
// controllers/note.controller.ts
import { ApiDefaultResponse } from '@decorators/api-default-response.decorator.js';
import { CurrentUserId } from '@decorators/current-user-id.decorator.js';
import { Serialize } from '@decorators/serialize.decorator.js';
import { UseAbility } from '@modules/casl/decorators/use-ability.decorator.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import { AccessGuard } from '@modules/casl/guards/access.guard.js';
import { CursorPaginationQueryDto } from '@modules/common/dtos/cursor-pagination-query.dto.js';
import { CreateNoteDto } from '@modules/note/dtos/create-note.dto.js';
import { NoteListResponseDto } from '@modules/note/dtos/responses/note-list-response.dto.js';
import { NoteResponseDto } from '@modules/note/dtos/responses/note-response.dto.js';
import { UpdateNoteDto } from '@modules/note/dtos/update-note.dto.js';
import { NoteEntity } from '@modules/note/entities/note.entity.js';
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteListInterface } from '@modules/note/interfaces/note-list.interface.js';
import { NoteService } from '@modules/note/services/note.service.js';
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
@ApiTags('Notes')
@UseGuards(AccessGuard)
@Controller('notes')
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiDefaultResponse({ status: StatusCodes.CREATED, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @UseAbility(ActionsEnum.CREATE, NoteEntity)
  @Post()
  public create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateNoteDto,
  ): Promise<NoteInterface> {
    return this.noteService.create({ ...dto, userId });
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteListResponseDto })
  @Serialize(NoteListResponseDto)
  @UseAbility(ActionsEnum.READ, NoteEntity)
  @Get()
  public findMany(
    @CurrentUserId() userId: string,
    @Query() query: CursorPaginationQueryDto,
  ): Promise<NoteListInterface> {
    return this.noteService.findMany(userId, query);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @UseAbility(ActionsEnum.READ, NoteEntity)
  @Get(':id')
  public findById(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NoteInterface> {
    return this.noteService.findByIdOrThrow(id, userId);
  }

  @ApiDefaultResponse({ status: StatusCodes.OK, type: NoteResponseDto })
  @Serialize(NoteResponseDto)
  @UseAbility(ActionsEnum.UPDATE, NoteEntity)
  @Patch(':id')
  public update(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<NoteInterface> {
    return this.noteService.update(id, userId, dto);
  }

  @ApiDefaultResponse({ status: StatusCodes.NO_CONTENT })
  @UseAbility(ActionsEnum.DELETE, NoteEntity)
  @HttpCode(StatusCodes.NO_CONTENT)
  @Delete(':id')
  public deleteById(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.noteService.deleteById(id, userId);
  }
}
```

Endpoint checklist — every endpoint, no exceptions:

- [ ] Auth guard (or explicit `@Public()` with a reason comment)
- [ ] Permission check (`@UseAbility`) where CASL applies
- [ ] Throttling (global guard; per-route `@Throttle()` override for sensitive
      endpoints — login, password reset, contact form)
- [ ] `@ApiDefaultResponse` with the exact response type (+ documented error envelope)
- [ ] `@Serialize` allowlist serialization for every non-void response
- [ ] Piped params (`ParseUUIDPipe`) — no raw strings
- [ ] Method-level decorator order: Swagger → Serialize → ability → HTTP verb (last)

## 9. Module wiring

```typescript
// note.module.ts
import { CaslModule } from '@modules/casl/casl.module.js';
import { NOTE_REPOSITORY } from '@modules/note/constants/note.constants.js';
import { NoteController } from '@modules/note/controllers/note.controller.js';
import { notePermissions } from '@modules/note/permissions/note.permissions.js';
import { NotePrismaRepository } from '@modules/note/repositories/note-prisma.repository.js';
import { NoteService } from '@modules/note/services/note.service.js';
import { Module } from '@nestjs/common';

@Module({
  imports: [CaslModule.forFeature({ permissions: notePermissions })],
  controllers: [NoteController],
  providers: [NoteService, { provide: NOTE_REPOSITORY, useClass: NotePrismaRepository }],
  exports: [NoteService],
})
export class NoteModule {}
```

`exports: [NoteService]` — services only, always. Swapping the database is this
one `useClass` line per module.

## 10. Logging

`CustomLoggerService` (structured JSON in production), context = class name, one
class field per service. Use every level deliberately:

| Level | When | Example |
|---|---|---|
| `debug` | Flow detail useful only when diagnosing — inputs, branches, timings. Off in production by default (`LOG_LEVEL`) | `logger.debug(\`findMany limit=${limit}\`)` |
| `log` | State changes and lifecycle facts — created/updated/deleted, job started/finished, connection established | `logger.log(\`Note created: ${note.id}\`)` |
| `warn` | Recoverable anomalies — retry happened, fallback used, deprecated path hit, suspicious input rejected | `logger.warn(\`Redis reconnect attempt ${attempt}\`)` |
| `error` | Failures — always with the stack and enough context to act | `logger.error(\`Payment webhook failed: ${message}\`, stack)` |

Rules: never `console.log`; never log secrets, tokens, passwords, or raw bodies of
auth endpoints; log IDs, not whole objects; every `catch` that swallows logs at
`warn` or `error` — silent catches are forbidden. HTTP request logging (method,
path, status, duration) is an interceptor concern, not per-endpoint code.

**Correlation:** every request gets an `X-Request-Id` (incoming header respected,
generated otherwise), stored in AsyncLocalStorage; `CustomLoggerService` attaches it
to every log line automatically (`requestId` field in the JSON). One request =
one greppable thread, across services, repositories, and providers.

## 10a. Operational rules (high-load defaults)

- **Graceful shutdown:** `app.enableShutdownHooks()`; on SIGTERM stop accepting
  connections, drain in-flight requests, close Prisma/Redis/SQS consumers. Rolling
  deploys must produce zero 5xx.
- **Health probes are split:** `GET /health/live` — process is up, no dependency
  checks (restart signal); `GET /health/ready` — DB + Redis reachable (traffic
  signal). Load balancers use `ready`, orchestrators use `live`.
- **Scheduled jobs always take a Redis lock** (`SET key NX PX ttl`) keyed by job
  name before running. No lock, no run. A cron that misbehaves at `instances > 1`
  is a bug even if we currently run one instance.
- **Connection-pool math is documented in `.env.example`:**
  `instances × connection_limit ≤ max_connections − reserved`. Changing instance
  count without revisiting the pool size is a deploy error.
- **Swagger in production:** disabled by default; enabling requires explicit config
  and basic auth.
- **No app-level compression:** gzip/brotli belong to CloudFront/ALB. App CPU serves
  requests, not encoding.
- **Security headers are transport config, set once at bootstrap** —
  `registerSecurityHeaders` (`@fastify/helmet`), never per controller. The CSP is a
  JSON-API CSP (`default-src 'none'` + an explicit `frame-ancestors 'none'`, which
  does not fall back to `default-src`); HSTS is production-only, because sending it
  over `http://localhost` pins the developer's whole localhost origin to https.
  Exactly one route deviates — Swagger's, which is a real HTML document and gets its
  own same-origin policy in `setup-swagger.helper.ts`, mounted only where the docs
  are mounted. A route needing different headers gets them at that hook, with the
  reason written down; controllers never set security headers.
- **CORS is an exact-match allowlist and `credentials: false` — permanently.** This
  API is bearer-only: tokens travel in the `Authorization` header, in request bodies,
  and in the Socket.IO handshake payload. Nothing sets or reads a cookie, so there is
  no ambient credential for a browser to attach and
  `Access-Control-Allow-Credentials` would buy nothing while coupling the allowlist
  to a CSRF exposure. A failing browser call is fixed in `CORS_ORIGINS` or the
  allowed-header list, never by flipping that flag; flipping it is only correct as
  part of a deliberate move to cookie auth, with the CSRF defences that implies.
- **`X-Forwarded-For` is trusted only under `TRUST_PROXY`.** The flag is read in two
  places — the Fastify adapter (`request.ip`) and `ThrottlerBehindProxyGuard` — and
  they must agree. Any new per-ip logic reads `request.ip`; a second place that
  parses the header on its own would reopen the spoofing hole for whichever budget
  it guards.

## 10b. Caching

One agnostic `CacheService` facade in front of pluggable, contract-bound stores.
Feature code never talks to Redis (or any store) directly for caching — only
through the facade. Same golden rule as repositories: adding an S3 tier or
swapping Redis means a new store implementation + a binding change, zero
consumer edits.

```
Feature code → CacheService → [ MemoryCacheStore (L1) ] → [ RedisCacheStore (L2) ]
                    ↑ facade         optional tier              shared tier
```

```typescript
// modules/common/providers/cache/interfaces/cache-store.interface.ts — every tier implements it
export interface CacheStoreInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}
```

```typescript
// modules/common/providers/cache/services/cache.service.ts — the only entry point
public async wrap<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const cached: T | null = await this.getWithBackfill<T>(key, ttlMs);

  if (cached !== null) return cached;

  return this.singleFlight<T>(key, async (): Promise<T> => {
    const value: T = await factory();

    await this.set(key, value, ttlMs);

    return value;
  });
}
```

- Tiers are ordered: read-through (L1 hit returns; L1 miss checks L2 and
  backfills L1), write/delete fan out to all tiers. Composition is config:
  memory+redis for hot paths, redis-only by default.
- `MemoryCacheStore` is bounded (LRU, max entries) — an unbounded in-memory cache
  is a memory leak with extra steps.
- **Multi-instance truth:** the memory tier is per-instance. It may only hold data
  that tolerates staleness up to its TTL — so L1 TTLs are seconds, not minutes.
  If an L1 entry must die on write, invalidate via Redis pub/sub broadcast — or
  don't use L1 for it.
- **Stampede protection:** `wrap()` single-flights concurrent misses per key
  in-process; expensive factories additionally take a short Redis lock.
- Keys are namespaced constants, never inline strings:
  `cache-key.constants.ts` per module, format `<module>:<entity>:<id>`.
- TTL is always explicit. No default TTL, no infinite entries.
- **`wrap()` treats `null` as a miss** — a factory legitimately returning `null`
  re-runs on every call. Never cache raw `null`; wrap it (`{ value: null }`).
- **Backfill re-grants the full TTL** to upper tiers on a lower-tier hit, so the
  worst-case staleness bound is 2× the L1 TTL. Size L1 TTLs accordingly.
- Invalidation strategy is stated at the call site (comment): TTL-expiry (default)
  or event-driven delete on write. "It'll expire eventually" is a decision, not
  an accident.
- HTTP-layer caching (browser, CloudFront, S3) is a separate concern: responses opt
  in via explicit `Cache-Control` headers; the API defaults to `no-store` on
  authenticated endpoints.

## 11. Errors

Errors are **coded, module-owned, and transport-agnostic**. Never inline strings,
never HTTP exceptions in services.

**Constants — one file per module**, `constants/<module>-errors.constants.ts`,
string codes prefixed with the module name:

```typescript
// modules/note/constants/note-errors.constants.ts
import type { ErrorArgsInterface } from '@interfaces/error-args.interface.js';

export const NOTE_NOT_FOUND: ErrorArgsInterface = {
  code: 'NOTE_NOT_FOUND',
  details: 'Note not found',
};

export const NOTE_ACCESS_DENIED: ErrorArgsInterface = {
  code: 'NOTE_ACCESS_DENIED',
  details: 'This note belongs to another user',
};
```

Deleting a module deletes its codes — nothing central to edit. The registry check is a
unit spec, `modules/common/errors/tests/error-codes.spec.ts`: it collects every
`*errors.constants.ts` and fails on a duplicate code or a code that differs from its
constant name, so `pnpm run test` catches both in CI.

**Domain errors — services throw meaning, not transport.** `AppError` subclasses
in `common/errors/` carry a semantic category; the thrown class is the category:

| Domain error | Category | HTTP maps to |
|---|---|---|
| `ValidationError` | VALIDATION | 400 |
| `UnauthorizedError` | UNAUTHORIZED | 401 |
| `ForbiddenError` | FORBIDDEN | 403 |
| `NotFoundError` | NOT_FOUND | 404 |
| `ConflictError` | CONFLICT | 409 |
| `InternalError` | INTERNAL | 500 |

```typescript
if (!note) throw new NotFoundError(NOTE_NOT_FOUND);
```

**Transports map at the edge.** The HTTP `AllExceptionsFilter` owns the only
category→status map and renders the envelope
`{ statusCode, code, details, timestamp, path }`. A future WS/gRPC transport adds
its own filter with its own map — services never change. Nest's own
`HttpException`s remain legal only in genuinely HTTP-layer code (pipes, guards,
router) and get generic status-derived codes; anything needing a specific code is
a domain error.

## 11a. Domain-event subscribers and side-channel fan-out

Cross-feature reactions (audit rows, notifications, digests) subscribe to the
event bus with `@OnDomainEvent(EVENT_NAME)` — never by importing the emitting
feature module. Event names are constants in the core `event` module; payloads
are interfaces in the subscribing module. The reference implementation is
`notification`'s `NotificationEventSubscriberService` (one subscriber per module: a
thin event → content mapping that funnels every handler into one dispatch path);
`ActivityListener.safeRecord` is the same pattern one size smaller.

Binding rules for every subscriber that persists and then delivers:

- **Persist-first.** The durable row is written before any delivery channel
  (socket push, unread-count push, email) is attempted. A channel failure logs
  at `warn` and never rolls back or retries the row; a persistence failure
  skips fan-out entirely. There is no path where a channel touches the network
  before the repository write returns.
- **Subscribers never break the emitter.** Handler failures are contained
  (logged, swallowed) — the business transaction that emitted the event must
  succeed or fail on its own merits, never on a listener's.
- **Preferences gate channels, never persistence.** Per-user preferences (and
  provider flags like `MAIL_ENABLED`/`WEBSOCKET_ENABLED`) decide whether a
  *delivery channel* fires. They are consulted after the row is persisted; a
  user with every channel off still gets the in-app row.
- **Each channel is independently contained** — its own try/catch, its own
  `warn`; one channel's failure never prevents the next.
- **Outbound side-channels that can storm are throttled server-side** with an
  atomic Redis claim (`SET key NX EX window`, keyed per recipient and type,
  behind a repository contract). Availability gates fail open and log loudly
  (`LoginLockoutService.isLockedSafely`, the notification email throttle);
  security gates fail closed (the gateway's heartbeat revalidation).
- Event → content mapping lives in pure `builders/` functions (no I/O, no DI),
  so content is unit-testable and the subscriber stays a routing table.
- **Persisted content is denormalized (subtraction-safe).** The row stores
  title/body/meta as-is at dispatch time — never a join back to the emitting
  feature's tables, so removing either module leaves no dangling reference.

## 11b. WebSocket gateways and transport adapters

A gateway is a transport edge, exactly like a controller: handshake auth, room
membership, lifecycle — zero domain logic, zero repository access. Emission
into sockets is a service concern (`NotificationFanOutService`), not the
gateway's. Reference: `notification`'s `NotificationGateway` + adapters.

- **Handshake auth = HTTP auth.** The client sends the access token in the
  Socket.IO handshake `auth.token` payload (travels in the CONNECT packet over
  the established transport — never in a URL or query string, no cookies). The
  gateway verifies it with the exact same `TokenService.verifyAccessToken`
  (signature + Redis allowlist) the HTTP guard uses. Any failure disconnects
  with a coded, server-side-logged reason; nothing about the failure is emitted
  to the client.
- **Revocation liveness.** Long-lived connections re-verify on a heartbeat: one
  shared interval sweeps the tracked socket set and re-runs the full token
  verification per socket; failures (including Redis errors) disconnect —
  fail-closed. The interval is a config knob (`WEBSOCKET_HEARTBEAT_INTERVAL_MS`)
  and is cleared in `onModuleDestroy`.
- **Rooms are joined server-side only** from verified claims. No
  `@SubscribeMessage` handler exists unless the feature genuinely needs
  client → server messages.
- **No config reads in decorator options.** `@WebSocketGateway({ ... })`
  options evaluate at module-import time — before `.env` is loaded and before
  DI exists. Anything configuration-dependent (CORS origins above all) is
  injected at bootstrap by the adapter, which resolves it from the same
  `ConfigService` object the HTTP layer uses. One parse, one source: socket
  CORS comes from `AppConfig.corsOrigins`, the same field
  `configure-app.helper.ts` feeds to `enableCors`.
- **The adapter is the off-switch.** `<X>_ENABLED=false` for a socket transport
  means the server never attaches a socket endpoint and opens no adapter Redis
  connections (§12: no third state). Bootstrap installs the real Redis-backed
  adapter when enabled and a `Disabled*` adapter (detached server, nothing
  bound to HTTP) when not — rejecting handshakes after accepting them is not
  "off", it is a reconnect loop generator. Fan-out services check the same
  config flag and skip socket channels outright.
- Bootstrap wiring lives in one module-owned helper used by both `main.ts` and
  the e2e app factory, inside the module's removal fences.

## 12. DTOs, entities, permissions, configs

Wire shapes (request/response) are defined once in `packages/shared` and DTOs
`implements` them — see [`shared-contracts.md`](./shared-contracts.md). Domain
interfaces stay module-private; only wire contracts are shared. Enums whose values
travel on the wire live in `packages/shared` too and are imported from there
(`NoteStatusEnum`, `UserRoleEnum`); a module's `enums/` folder holds only the enums
that never leave the API.

**Request DTO** — decorator order per field: Swagger → class-validator → `@Type()`.
Required fields use `@ApiProperty`, optional use `@ApiPropertyOptional` and are typed
`T | undefined`. Composition via `PickType`/`OmitType` from `@nestjs/swagger`:

```typescript
// dtos/create-note.dto.ts
import { type CreateNoteRequestInterface, NoteStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNoteDto implements CreateNoteRequestInterface {
  @ApiProperty({ type: String, example: 'My note', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  readonly title: string;

  @ApiPropertyOptional({ type: String, example: 'Body text' })
  @IsOptional()
  @IsString()
  readonly body?: string | undefined;

  @ApiPropertyOptional({ enum: NoteStatusEnum, example: NoteStatusEnum.ACTIVE })
  @IsOptional()
  @IsEnum(NoteStatusEnum)
  readonly status?: NoteStatusEnum | undefined;
}
```

The `implements` clause is the drift check: change the shared request contract and this
DTO stops compiling until it catches up. Body scalars need no `@Type()` — the global
`ValidationPipe({ whitelist: true, transform: true })` handles them. `@Type()` earns its
place in exactly two spots: numeric **query** params (`@Type(() => Number)`, see
`CursorPaginationQueryDto`) and nested objects/arrays, where it pairs with
`@ValidateNested`:

```typescript
  @ApiPropertyOptional({ type: [NoteTagDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteTagDto)
  readonly tags?: NoteTagDto[] | undefined;
```

**Never `@Type(() => Boolean)` on a query flag** — `Boolean('false')` is `true`, so the
filter can never be switched off. Boolean query params use an explicit
`@Transform(({ value }) => value === 'true' || value === true)`, the pattern in
`NotificationsQueryDto` and `RevokeSessionsQueryDto`.

```typescript
// dtos/update-note.dto.ts — composition, never a hand-copied field list
import { CreateNoteDto } from '@modules/note/dtos/create-note.dto.js';
import type { UpdateNoteRequestInterface } from '@nest-aws-starter/shared';
import { PartialType } from '@nestjs/swagger';

export class UpdateNoteDto
  extends PartialType(CreateNoteDto)
  implements UpdateNoteRequestInterface {}
```

**Response DTO** — `@Exclude()` at class level, `@Expose()` per visible field
(allowlist, never blocklist), and it `implements` the **shared wire interface**, not
the domain interface. That distinction is load-bearing: the domain model carries
`Date`, the wire carries ISO-8601 strings, so dates are `string` here and are rendered
with `@Transform`, never `@Type(() => Date)`:

```typescript
// dtos/responses/note-response.dto.ts
import { type NoteResponseInterface, NoteStatusEnum } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class NoteResponseDto implements NoteResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'My note' })
  @Expose()
  readonly title: string;

  @ApiProperty({ type: String, example: 'Body text' })
  @Expose()
  readonly body: string;

  @ApiProperty({ enum: NoteStatusEnum, example: NoteStatusEnum.ACTIVE })
  @Expose()
  readonly status: NoteStatusEnum;

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

List responses wrap the item DTO and are their own file
(`dtos/responses/note-list-response.dto.ts`); that is the one place `@Type(() => X)`
appears in a response DTO, to build the nested array.

**Entity** — a CASL permission subject, and nothing else. It is never serialized and
never returned, so it carries **no decorators at all**: no `@Exclude()`, no `@Expose()`,
no `@ApiProperty`. It is a bare class whose only jobs are to give CASL a metadata target
and to `implements` the domain interface so the ability conditions (`{ userId: … }`)
are type-checked against real fields. Fields use `declare readonly` — they are never
assigned, because instances are never constructed:

```typescript
// entities/note.entity.ts
import type { NoteInterface } from '@modules/note/interfaces/note.interface.js';
import type { NoteStatusEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for note permissions.
export class NoteEntity implements NoteInterface {
  declare readonly id: string;
  declare readonly userId: string;
  declare readonly title: string;
  declare readonly body: string;
  declare readonly status: NoteStatusEnum;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
```

If you ever reach for `@Serialize(SomeEntity)`, you want a response DTO instead — no
endpoint in this codebase serializes an entity.

**Permissions** — one file per module in `permissions/`, registered in the module
via `CaslModule.forFeature`. Roles come from the shared `UserRoleEnum` — never from the
generated Prisma enums. The shape is `PermissionsType` (a
`Partial<Record<UserRoleEnum, (context: PermissionContextInterface) => void>>`), the
actions come from `ActionsEnum`, and each handler is an explicitly typed arrow keyed by
the enum member:

```typescript
// permissions/note.permissions.ts
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { NoteEntity } from '@modules/note/entities/note.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const notePermissions: PermissionsType = {
  [UserRoleEnum.USER]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, NoteEntity);
  },
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, NoteEntity);
  },
};
```

The context also carries `user` and `cannot`, so per-owner rules are written
`can(ActionsEnum.UPDATE, NoteEntity, { userId: user.id })`. The note module grants
`MANAGE` outright because `NoteService` already enforces ownership itself (§7) —
authorization lives in exactly one place per resource, never half in each.

```typescript
// note.module.ts — registration line
imports: [CaslModule.forFeature({ permissions: notePermissions })],
```

**Config** — Zod schema → inferred type → `registerAs` returning
`validateConfigSchema(configSchema, { … })`; consumed via
`configService.getOrThrow<XConfig>('x')`. The validator returns the *parsed* value, so
the factory never holds an unvalidated object: there is no separate `const config`
to forget to check. The schema is always named `configSchema` — one file, one schema,
so a qualifier would say nothing — and the exported type is a plain
`z.infer<typeof configSchema>`: Zod already yields required keys, so wrapping it in
`Required<>` claims a guarantee it is not adding.

**Optional providers are enabled, never half-configured.** Every optional provider
(S3, SQS, SNS, SES, Lambda, …) has an `<X>_ENABLED` flag, and its config is a Zod
**discriminated union**:

- `isEnabled: false` → no other variable is read or validated. Zero noise.
- `isEnabled: true` → every variable of that provider is required and strictly
  validated (`z.string().min(1)` — empty strings are config errors) and the app
  **fails at boot**, not on first use.

There is no third state. Optional-with-empty-defaults ("everything boots, then the
first `sendMessage` explodes") is forbidden.

```typescript
// src/configs/sqs.config.ts
import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    endpoint: z.url().optional(),
  }),
]);

export type SqsConfig = z.infer<typeof configSchema>;

export const sqsConfig = registerAs('sqs', (): SqsConfig => {
  const isEnabled: boolean = process.env.SQS_ENABLED === 'true';

  return validateConfigSchema(
    configSchema,
    isEnabled
      ? {
          isEnabled: true,
          region: process.env.AWS_REGION ?? '',
          ...(process.env.AWS_ENDPOINT_URL && { endpoint: process.env.AWS_ENDPOINT_URL }),
        }
      : { isEnabled: false },
  );
});
```

Config factories log nothing. They are evaluated at module-registration time, before DI
or any logger transport exists, so a bad value throws out of `ConfigModule.forRoot()`
and Nest prints the boot failure with the Zod issue list attached — one report, not a
log line plus a throw. This is also the one file kind where an exported `type` sits next
to its `registerAs` (§2): `SqsConfig` is inferred from the schema and inseparable from
it. Zod 4 spells URL validation `z.url()`, not `z.string().url()`.

When a provider is disabled, its module binds a `Disabled<X>Provider` implementing
the same contract — every method throws a coded 500 (`"SQS provider is disabled —
set SQS_ENABLED=true"`). Consumers keep compiling; misuse fails loudly and
explains itself. `/health/ready` reports only enabled providers. `.env.example`
groups variables per provider under its `<X>_ENABLED` flag.

A config that is **not** an optional provider — one the app cannot boot without — needs
no discriminated union, just a flat schema with defaults:

```typescript
// src/configs/app.config.ts
import { validateConfigSchema } from '@helpers/validate-config-schema.helper.js';
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const configSchema = z.object({
  port: z.number(),
  env: z.enum(['development', 'test', 'production']),
  apiPrefix: z.string(),
  trustProxy: z.boolean(),
  corsOrigins: z.array(z.url()),
});

export type AppConfig = z.infer<typeof configSchema>;

export const appConfig = registerAs('app', (): AppConfig => {
  return validateConfigSchema(configSchema, {
    port: Number(process.env.PORT ?? 3000),
    env: (process.env.NODE_ENV ?? 'development') as AppConfig['env'],
    apiPrefix: process.env.API_PREFIX ?? 'api',
    trustProxy: process.env.TRUST_PROXY === 'true',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((origin: string): string => origin.trim())
      .filter((origin: string): boolean => origin.length > 0),
  });
});
```

## 13. Tests

No module merges untested; tests land in the same commit series.

- **Unit** (`<module>/tests/*.spec.ts`): services and guards; repository contracts
  mocked at the interface (token) level — unit tests never touch Prisma.
- **E2E** (`apps/api/test/*.e2e-spec.ts`): supertest against the running app with real
  Postgres/Redis/LocalStack. Per endpoint: happy path + 401 unauthenticated +
  403 forbidden + 404 missing + validation 400 with the exact error `code`.
- Deepest suites on the security-relevant paths: auth, identity linking, payments.

## 14. Code style

- Single quotes, trailing commas, 2-space indent (Biome-enforced).
- `const` by default; early returns — no `else` after `return`.
- Empty line between adjacent variable declarations; empty line before
  `return`/`continue`/`break` inside blocks.
- Minimal comments — only *why*, never *what*.
- Path aliases only (`@modules/...`, `@interfaces/...`, `@src/...`); relative imports in
  `apps/api/src` are blocked by Biome (`style/noRestrictedImports`, configured in the
  root `biome.json` override for `apps/api/src/**`), so `pnpm exec biome ci .` fails on
  one. Two deliberate exclusions: `apps/api/test`, whose specs import their own harness
  siblings (`./app.factory.js`) and which declares no alias of its own, and the two
  frontends, which import relatively by design (see [`frontend.md`](./frontend.md)).
- **Every intra-project import ends in `.js`**, aliases included
  (`@modules/note/services/note.service.js`). `apps/api` is native ESM under
  `module: nodenext`, so the runtime specifier is what ships; TypeScript resolves the
  `.ts` behind it. Package imports (`@nestjs/common`, `@nest-aws-starter/shared`) take
  no extension.
- Imports are sorted by Biome's organizer (`biome check --write`); do not hand-order
  them.
- Always `await` — no floating promises.

## 15. Anti-patterns (forbidden)

| Anti-pattern | Instead |
|---|---|
| Loose `*.controller.ts`/`*.service.ts` at module root | Dedicated folder per artifact kind, even for a single file (`controllers/`, `services/`, `repositories/`, `constants/`) |
| Service depending on a concrete repository class | Contract interface via injection token |
| Module exporting a repository | Export the service; others ask the service |
| `@generated/prisma/*` outside `*-prisma.repository.ts` | New named contract method |
| Repository returning an ORM model or response DTO | `toDomain()` → domain interface |
| Business logic in a controller (pre-checks, casts) | Service method (`deleteById` owns the 404) |
| `type` for an object shape | `interface` in `interfaces/` |
| Interface/type/enum declared inside a provider/service/controller file | Dedicated file in the owning folder's `interfaces/`, `types/`, `enums/` |
| Two or more interfaces/types in one file | One declaration per file |
| Function > 25 lines / file > 300 lines | Extract named private methods / split |
| `console.log`, silent `catch` | Leveled logger; every catch logs |
| Endpoint missing auth/throttle/Swagger/Serialize | Full endpoint checklist, every time |
| Inline error strings | Coded constants |
| Service throwing `HttpException`/`NotFoundException` | Domain `AppError` (`NotFoundError`, …); transports map at the edge |
| Feature module adding codes to a shared errors file | Module-owned `<module>-errors.constants.ts` |
| Feature module importing a feature module | Event bus or core dependency |
