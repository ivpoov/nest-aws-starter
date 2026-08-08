# Backend Conventions

NestJS — TypeScript — Prisma — PostgreSQL — Redis — Zod

These rules are binding. Every module in `apps/api` follows them; the shipped `note`
module is the living reference implementation. When in doubt, imitate the sample module.

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
- `@prisma/client` may be imported only inside `*-prisma.repository.ts` files and
  Prisma infrastructure. Anywhere else it is a lint error.
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
import { NoteStatusEnum } from '@modules/note/enums/note-status.enum';

export interface NoteInterface {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatusEnum;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

```typescript
// interfaces/note-created-payload.interface.ts  (event payloads are interfaces too)
export interface NoteCreatedPayloadInterface {
  readonly noteId: string;
}
```

### Type — only what an interface cannot express

```typescript
// types/redis-client.type.ts — union of two classes
import { Cluster, Redis } from 'ioredis';

export type RedisClientType = Redis | Cluster;
```

```typescript
// types/note-sort-field.type.ts — literal union
export type NoteSortFieldType = 'createdAt' | 'title' | 'status';
```

```typescript
// types/update-note-data.type.ts — utility composition (when derived, not authored)
import { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface';

export type UpdateNoteDataType = Partial<CreateNoteDataInterface>;
```

If it has named properties you are writing by hand — it is an `interface`, full stop.

### Enum

```typescript
// enums/note-status.enum.ts
export enum NoteStatusEnum {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
```

String-valued, PascalCase name with `Enum` suffix, one per file.

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
│   └── update-note-data.interface.ts
├── dtos/
│   ├── create-note.dto.ts
│   ├── update-note.dto.ts
│   └── responses/
│       └── note-response.dto.ts
├── entities/
│   └── note.entity.ts                    # CASL subject / record-as-is responses
├── permissions/
│   └── note.permissions.ts               # CASL rules for this module
├── enums/
│   └── note-status.enum.ts
└── tests/
    ├── note.service.spec.ts
    └── note.e2e-spec.ts
```

Modules that own other artifact kinds add sibling folders under the same rule —
one kind per folder, even for a single file:

| Folder | Owns | Reference module |
|---|---|---|
| `gateways/` | WebSocket gateways — transport concerns only (handshake auth, room joins, revalidation), no domain logic, no repository access (§11b) | `notification` |
| `adapters/` | Transport adapters installed at bootstrap (e.g. the Redis-backed Socket.IO adapter and its disabled twin) (§11b) | `notification` |
| `builders/` | Pure event-payload → persisted-content mappers — no I/O, no DI (§11a) | `notification` |
| `templates/` | Mail/render templates — pure functions returning content shapes | `auth`, `suspicious-activity`, `notification` |
| `helpers/` | Module-owned free functions needed outside DI (e.g. bootstrap wiring) | `notification` |

Registered by exactly one line in `AppModule`. Feature modules never import other
feature modules — cross-feature communication goes through the event bus or core
modules (`user`, `auth`) and providers only; a dependency rule in CI enforces it.

## 5. Contract + token

```typescript
// constants/note.constants.ts
export const NOTE_REPOSITORY = Symbol('NOTE_REPOSITORY');
```

```typescript
// interfaces/note-repository.interface.ts
import { NoteInterface } from '@modules/note/interfaces/note.interface';
import { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface';
import { UpdateNoteDataInterface } from '@modules/note/interfaces/update-note-data.interface';
import { PaginationInterface } from '@interfaces/pagination.interface';

export interface NoteRepositoryInterface {
  create(data: CreateNoteDataInterface): Promise<NoteInterface>;
  findById(id: string): Promise<NoteInterface | null>;
  findMany(pagination: PaginationInterface): Promise<NoteInterface[]>;
  update(id: string, data: UpdateNoteDataInterface): Promise<NoteInterface>;
  deleteById(id: string): Promise<void>;
}
```

Nothing in this contract knows a database exists. That is the point.

## 6. Repository implementation (the only Prisma zone)

```typescript
// repositories/note-prisma.repository.ts
import { Injectable } from '@nestjs/common';
import { Note } from '@prisma/client';
import { PrismaService } from '@modules/prisma/prisma.service';
import { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface';
import { NoteInterface } from '@modules/note/interfaces/note.interface';
import { CreateNoteDataInterface } from '@modules/note/interfaces/create-note-data.interface';
import { PaginationInterface } from '@interfaces/pagination.interface';

@Injectable()
export class NotePrismaRepository implements NoteRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  public async create(data: CreateNoteDataInterface): Promise<NoteInterface> {
    const note: Note = await this.prisma.note.create({ data });

    return this.toDomain(note);
  }

  public async findById(id: string): Promise<NoteInterface | null> {
    const note: Note | null = await this.prisma.note.findUnique({ where: { id } });

    return note ? this.toDomain(note) : null;
  }

  public async findMany(pagination: PaginationInterface): Promise<NoteInterface[]> {
    const notes: Note[] = await this.prisma.note.findMany({
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    });

    return notes.map((note: Note): NoteInterface => this.toDomain(note));
  }

  private toDomain(note: Note): NoteInterface {
    return {
      id: note.id,
      title: note.title,
      body: note.body,
      status: note.status,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
```

Prisma model types appear only here, only as local variable types. A future
`NoteMongooseRepository` implements the same contract in a sibling file; the module
binding is the only other line that changes.

The only Prisma error codes a repository may branch on are `P2025` (not-found
signal, e.g. `update`/`delete` on a missing row) and `P2002` (idempotent-replay
signal, e.g. a unique-constraint hit on a repeated create) — both confined to the
repository, never leaked as raw Prisma errors past its boundary.

### TypedSQL — the blessed pattern for hand-optimized queries

When the query builder is the wrong tool (aggregations, reports, window functions),
use Prisma TypedSQL — never string-built `$queryRaw`:

- The SQL lives in `prisma/sql/<name>.sql`; `prisma generate --sql` produces a fully
  typed function.
- TypedSQL functions are called **only inside repositories**, and their rows are
  mapped to domain interfaces like any other result — the contract never reveals
  that raw SQL exists.

```sql
-- prisma/sql/countNotesByStatus.sql
SELECT status, COUNT(*)::int AS count
FROM notes
GROUP BY status;
```

```typescript
// repositories/note-prisma.repository.ts
import { countNotesByStatus } from '@prisma/client/sql';

public async countByStatus(): Promise<NoteStatusCountInterface[]> {
  const rows: countNotesByStatus.Result[] = await this.prisma.$queryRawTyped(countNotesByStatus());

  return rows.map((row: countNotesByStatus.Result): NoteStatusCountInterface => ({
    status: row.status,
    count: row.count,
  }));
}
```

### Pagination: cursor by default

Offset pagination (`OFFSET n`) scans and discards `n` rows — it degrades linearly
and is forbidden for public/high-volume endpoints. The standard is cursor-based:

```typescript
// interfaces/cursor-pagination.interface.ts (common)
export interface CursorPaginationInterface {
  readonly cursor: string | null;   // id of the last item of the previous page
  readonly limit: number;
}
```

```typescript
public async findManyAfter(pagination: CursorPaginationInterface): Promise<NoteInterface[]> {
  const notes: Note[] = await this.prisma.note.findMany({
    take: pagination.limit,
    ...(pagination.cursor && { cursor: { id: pagination.cursor }, skip: 1 }),
    orderBy: { id: 'desc' },        // UUIDv7 ids are time-ordered — id order IS creation order
  });

  return notes.map((note: Note): NoteInterface => this.toDomain(note));
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

### Schema rules

- Primary keys: `String @id @default(uuid(7))` — UUIDv7, time-ordered.
- Every foreign key and every column used in a `where`/`orderBy` gets an explicit
  `@@index` in the same migration that introduces the query. "Prisma made the FK"
  is not an index.

## 7. Service (business logic only, the module's sole export)

```typescript
// services/note.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { NOTE_REPOSITORY } from '@modules/note/constants/note.constants';
import { NOTE_NOT_FOUND } from '@modules/note/constants/note-errors.constants';
import { NoteRepositoryInterface } from '@modules/note/interfaces/note-repository.interface';
import { NoteInterface } from '@modules/note/interfaces/note.interface';
import { CreateNoteDto } from '@modules/note/dtos/create-note.dto';
import { EventBusService } from '@modules/event/services/event-bus.service';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service';
import { NotFoundError } from '@modules/common/errors/not-found.error';
import { PaginationInterface } from '@interfaces/pagination.interface';

@Injectable()
export class NoteService {
  private readonly logger = new CustomLoggerService(NoteService.name);

  constructor(
    @Inject(NOTE_REPOSITORY)
    private readonly noteRepository: NoteRepositoryInterface,
    private readonly eventBus: EventBusService,
  ) {}

  public async create(dto: CreateNoteDto): Promise<NoteInterface> {
    const note: NoteInterface = await this.noteRepository.create({ ...dto });

    this.logger.log(`Note created: ${note.id}`);
    this.eventBus.emit('note.created', { noteId: note.id });

    return note;
  }

  public async findByIdOrThrow(id: string): Promise<NoteInterface> {
    const note: NoteInterface | null = await this.noteRepository.findById(id);

    if (!note) throw new NotFoundError(NOTE_NOT_FOUND);

    return note;
  }

  public async deleteById(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.noteRepository.deleteById(id);

    this.logger.log(`Note deleted: ${id}`);
  }
}
```

- Existence checks, ownership checks, throws — in the service. Controllers never
  pre-check, cast, or compensate.
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
// providers/cache/interfaces/cache-store.interface.ts — the contract every tier implements
export interface CacheStoreInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}
```

```typescript
// providers/cache/services/cache.service.ts — the only entry point for features
public async wrap<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const cached: T | null = await this.getFromTiers<T>(key);

  if (cached !== null) return cached;

  const value: T = await this.singleFlight(key, factory);

  await this.setToTiers(key, value, ttlMs);

  return value;
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
import { ErrorArgsInterface } from '@interfaces/error-args.interface';

export const NOTE_NOT_FOUND: ErrorArgsInterface = {
  code: 'NOTE_NOT_FOUND',
  details: 'Note not found',
};
```

Deleting a module deletes its codes — nothing central to edit. The `error-codes`
spec is the registry: it collects every `*errors.constants.ts` and fails CI on a
duplicate code or a code that differs from its constant name.

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
`notification`'s `NotificationDispatcherService` (one subscriber per module: a
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
`implements` them — see `docs/conventions/shared-contracts.md`. Domain interfaces
stay module-private; only wire contracts are shared.

**Request DTO** — decorator order per field: Swagger → class-validator → `@Type()`.
Required fields use `@ApiProperty`, optional use `@ApiPropertyOptional` and are typed
`T | undefined`. Composition via `PickType`/`OmitType` from `@nestjs/swagger`:

```typescript
// dtos/create-note.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NoteStatusEnum } from '@modules/note/enums/note-status.enum';
import { NoteTagDto } from '@modules/note/dtos/note-tag.dto';

export class CreateNoteDto {
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

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  readonly isPinned?: boolean | undefined;

  @ApiPropertyOptional({ type: [NoteTagDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteTagDto)
  readonly tags?: NoteTagDto[] | undefined;
}
```

```typescript
// dtos/update-note.dto.ts — composition, never a hand-copied field list
import { PartialType } from '@nestjs/swagger';
import { CreateNoteDto } from '@modules/note/dtos/create-note.dto';

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
```

**Response DTO** — `@Exclude()` at class level, `@Expose()` per visible field
(allowlist, never blocklist), implements the domain interface, `@Type(() => X)` for
nested objects/arrays/dates:

```typescript
// dtos/responses/note-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { NoteInterface } from '@modules/note/interfaces/note.interface';
import { NoteStatusEnum } from '@modules/note/enums/note-status.enum';

@Exclude()
export class NoteResponseDto implements NoteInterface {
  @ApiProperty({ type: String, example: '6d3d19c1-9e6a-4a5b-8f21-0f1d2c3b4a5e' })
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

  @ApiProperty({ type: Date, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Type(() => Date)
  readonly createdAt: Date;

  @ApiProperty({ type: Date, example: '2026-08-02T12:00:00.000Z' })
  @Expose()
  @Type(() => Date)
  readonly updatedAt: Date;
}
```

**Entity** — the CASL permission subject (and DB-record response shape when the
response is the record as-is). Same decorator rules as response DTOs; sensitive
fields get `@Exclude()` explicitly even though the class-level `@Exclude()` already
hides them (defense in depth, and it documents intent):

```typescript
// entities/note.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { NoteInterface } from '@modules/note/interfaces/note.interface';

@Exclude()
export class NoteEntity implements NoteInterface {
  @ApiProperty({ type: String })
  @Expose()
  readonly id: string;

  /* ...same field pattern as NoteResponseDto */
}
```

**Permissions** — one file per module in `permissions/`, registered in the module
via `CaslModule.forFeature`. Roles come from our own enum — never from
`@prisma/client`:

```typescript
// permissions/note.permissions.ts
import { InferSubjects } from '@casl/ability';
import { Actions, Permissions } from '@modules/casl';
import { UserRoleEnum } from '@modules/user/enums/user-role.enum';
import { NoteEntity } from '@modules/note/entities/note.entity';

type Subjects = InferSubjects<typeof NoteEntity>;

export const notePermissions: Permissions<UserRoleEnum, Subjects, Actions> = {
  USER({ can, user }) {
    can(Actions.read, NoteEntity);
    can(Actions.create, NoteEntity);
    can(Actions.update, NoteEntity, { userId: user.id });
    can(Actions.delete, NoteEntity, { userId: user.id });
  },

  ADMIN({ can }) {
    can(Actions.manage, NoteEntity);
  },
};
```

```typescript
// note.module.ts — registration line
imports: [CaslModule.forFeature({ permissions: notePermissions })],
```

**Config** — Zod schema → inferred type → `registerAs` with `validateScheme` at the
end; consumed via `configService.getOrThrow<XConfig>('x')`.

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
const scheme = z.discriminatedUnion('isEnabled', [
  z.object({ isEnabled: z.literal(false) }),
  z.object({
    isEnabled: z.literal(true),
    region: z.string().min(1),
    queueUrl: z.string().url(),
  }),
]);

export type SqsConfig = z.infer<typeof scheme>;

export const sqsConfig = registerAs('sqs', (): SqsConfig => {
  const isEnabled: boolean = process.env.SQS_ENABLED === 'true';

  const config: SqsConfig = isEnabled
    ? {
        isEnabled: true,
        region: process.env.AWS_REGION ?? '',
        queueUrl: process.env.SQS_QUEUE_URL ?? '',
      }
    : { isEnabled: false };

  validateScheme(scheme, config, new CustomLoggerService('SqsConfig'));

  return config;
});
```

When a provider is disabled, its module binds a `Disabled<X>Provider` implementing
the same contract — every method throws a coded 500 (`"SQS provider is disabled —
set SQS_ENABLED=true"`). Consumers keep compiling; misuse fails loudly and
explains itself. `/health/ready` reports only enabled providers. `.env.example`
groups variables per provider under its `<X>_ENABLED` flag.

```typescript
// src/configs/s3.config.ts
import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { validateScheme } from '@helpers/validate-scheme.helper';
import { CustomLoggerService } from '@modules/logger/services/custom-logger.service';

const scheme = z.object({
  region: z.string(),
  bucketName: z.string(),
});

export type S3Config = Required<z.infer<typeof scheme>>;

export const s3Config = registerAs('s3', (): S3Config => {
  const config: S3Config = {
    region: process.env.AWS_REGION ?? 'us-east-1',
    bucketName: process.env.S3_BUCKET_NAME ?? '',
  };

  validateScheme(scheme, config, new CustomLoggerService('S3Config'));

  return config;
});
```

## 13. Tests

No module merges untested; tests land in the same commit series.

- **Unit** (`tests/*.spec.ts`): services and guards; repository contracts mocked at
  the interface (token) level — unit tests never touch Prisma.
- **E2E** (`tests/*.e2e-spec.ts`): supertest against the running app with real
  Postgres/Redis/LocalStack. Per endpoint: happy path + 401 unauthenticated +
  403 forbidden + 404 missing + validation 400 with the exact error `code`.
- Deepest suites on the security-relevant paths: auth, identity linking, payments.

## 14. Code style

- Single quotes, trailing commas, 2-space indent (Biome-enforced).
- `const` by default; early returns — no `else` after `return`.
- Empty line between adjacent variable declarations; empty line before
  `return`/`continue`/`break` inside blocks.
- Minimal comments — only *why*, never *what*.
- Path aliases only (`@modules/...`); relative imports are lint-blocked.
- Always `await` — no floating promises.

## 15. Anti-patterns (forbidden)

| Anti-pattern | Instead |
|---|---|
| Loose `*.controller.ts`/`*.service.ts` at module root | Dedicated folder per artifact kind, even for a single file (`controllers/`, `services/`, `repositories/`, `constants/`) |
| Service depending on a concrete repository class | Contract interface via injection token |
| Module exporting a repository | Export the service; others ask the service |
| `@prisma/client` outside `*-prisma.repository.ts` | New named contract method |
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
