import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@generated/prisma/client.js';
import { AuthMethodType } from '@generated/prisma/enums.js';
import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { AdminUserInterface } from '@modules/user/interfaces/admin-user.interface.js';
import { UserPrismaRepository } from '@modules/user/repositories/user-prisma.repository.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './app.factory.js';

// Indexes have no observable behaviour to assert through the API — the same
// rows come back either way, just slower — so the regression guard is that
// they exist at all on the migrated database. Each one below backs a query
// this suite already exercises; the comment says which, so a future reader
// can tell an index that earns its write cost from one that does not.
interface ExpectedIndexInterface {
  readonly table: string;
  readonly index: string;
  readonly backs: string;
}

const EXPECTED_INDEXES: ExpectedIndexInterface[] = [
  {
    table: 'activities',
    index: 'activities_createdAt_id_idx',
    backs: 'admin activity list filtered by dateFrom/dateTo alone',
  },
  {
    table: 'payment_transactions',
    index: 'payment_transactions_status_id_idx',
    backs: 'admin transaction list filtered by status, keyset-ordered by id',
  },
  {
    table: 'payment_transactions',
    index: 'payment_transactions_subscriptionId_idx',
    backs: 'the subscriptionId foreign key',
  },
  {
    table: 'subscriptions',
    index: 'subscriptions_planId_idx',
    backs: 'the planId foreign key',
  },
  {
    table: 'users',
    index: 'users_displayName_trgm_idx',
    backs: "the admin user search's substring match on display name",
  },
  {
    table: 'auth_methods',
    index: 'auth_methods_email_trgm_idx',
    backs: "the admin user search's substring match on linked emails",
  },
];

describe('database indexes', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(EXPECTED_INDEXES)('indexes $table with $index, backing $backs', async (expected) => {
    const rows: { indexname: string }[] = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${expected.table} AND indexname = ${expected.index}
    `;

    expect(rows).toHaveLength(1);
  });

  // Naming an index "_trgm_idx" proves nothing; being a GIN index over
  // gin_trgm_ops is what lets Postgres answer a leading wildcard at all.
  it.each([
    ['users', 'users_displayName_trgm_idx'],
    ['auth_methods', 'auth_methods_email_trgm_idx'],
  ])('builds %s.%s as a gin_trgm_ops GIN index', async (table: string, index: string) => {
    const rows: { indexdef: string }[] = await prisma.$queryRaw`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table} AND indexname = ${index}
    `;

    expect(rows[0]?.indexdef).toContain('USING gin');
    expect(rows[0]?.indexdef).toContain('gin_trgm_ops');
  });
});

// An index that exists and an index that gets used are different claims, and
// only the second one was ever the point of this work: with the trigram
// indexes in place but the email half of the search still expressed as an
// `authMethods: { some: … }` sub-condition, Postgres cannot fold the two
// predicates into one BitmapOr and walks the whole users table anyway. Every
// other test in the suite stays green through that regression, because the
// same rows come back — just after a full scan. These assert the plan.
describe('admin user search query plan', () => {
  const FIXTURE_PREFIX = 'PlanFixture';
  // Enough rows for the planner to produce a real plan rather than a
  // degenerate one over empty relations. Not tuned to make any particular
  // index win — see the note at the bottom of this block.
  const FIXTURE_ROWS = 500;

  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let loggingClient: PrismaClient;
  let repository: UserPrismaRepository;
  let captured: { sql: string; params: string[] }[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Both tables, not just users: an empty auth_methods is sequentially
    // scanned however it is indexed, and the assertion below would then fail
    // for a reason that has nothing to do with the query.
    const ids: string[] = Array.from({ length: FIXTURE_ROWS }, (): string => randomUUID());

    await prisma.user.createMany({
      data: ids.map((id: string, index: number): { id: string; displayName: string } => ({
        id,
        displayName: `${FIXTURE_PREFIX} ${index}`,
      })),
    });
    await prisma.authMethod.createMany({
      data: ids.map((id: string, index: number) => ({
        userId: id,
        type: AuthMethodType.EMAIL,
        email: `${FIXTURE_PREFIX.toLowerCase()}-${index}-${id}@example.com`,
      })),
    });
    await prisma.$executeRawUnsafe('ANALYZE users');
    await prisma.$executeRawUnsafe('ANALYZE auth_methods');

    // A second client purely to read back the SQL the repository emits —
    // PrismaService itself is constructed without query events, and this test
    // has to assert on the statements rather than on the rows.
    loggingClient = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
      log: [{ emit: 'event', level: 'query' }],
    });

    loggingClient.$on('query', (event: { query: string; params: string }): void => {
      captured.push({ sql: event.query, params: JSON.parse(event.params) as string[] });
    });

    repository = new UserPrismaRepository(loggingClient as unknown as PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { displayName: { startsWith: FIXTURE_PREFIX } } });
    await loggingClient.$disconnect();
    await app.close();
  });

  async function runSearch(search: string): Promise<{ sql: string; params: string[] }[]> {
    captured = [];

    const users: AdminUserInterface[] = await repository.findManyForAdmin({
      search,
      cursor: null,
      limit: 20,
    });

    expect(Array.isArray(users)).toBe(true);

    return captured.filter((entry): boolean => entry.sql.startsWith('SELECT'));
  }

  function findUsersQuery(queries: { sql: string; params: string[] }[]): {
    sql: string;
    params: string[];
  } {
    const match = queries.find((entry): boolean => entry.sql.includes('FROM "public"."users"'));

    expect(match).toBeDefined();

    return match as { sql: string; params: string[] };
  }

  async function explain(entry: { sql: string; params: string[] }): Promise<string> {
    const rows: Record<string, string>[] = await prisma.$queryRawUnsafe(
      `EXPLAIN ${entry.sql}`,
      ...entry.params,
    );

    return rows.map((row: Record<string, string>): string => row['QUERY PLAN'] ?? '').join('\n');
  }

  // The structural marker of the regression, independent of table size: the
  // users query must stand alone. The moment auth_methods appears inside it,
  // it is a correlated subquery again and no index on users can be combined
  // with it.
  it('queries users without a correlated subquery over auth_methods', async () => {
    const queries = await runSearch('zqx');
    const usersQuery = findUsersQuery(queries);

    expect(usersQuery.sql).not.toContain('auth_methods');
    expect(await explain(usersQuery)).not.toContain('auth_methods');
  });

  it('resolves the email half as its own bounded query', async () => {
    const queries = await runSearch('zqx');
    const emailQuery = queries.find(
      (entry): boolean =>
        entry.sql.includes('FROM "public"."auth_methods"') && entry.sql.includes('ILIKE'),
    );

    expect(emailQuery).toBeDefined();
    expect(emailQuery?.sql).toContain('LIMIT');
  });

  // A subplan is the shape of the bug in plan form: it is what the planner
  // produces for `authMethods: { some: … }`, and it is precisely what it
  // refuses to combine with an index on users. Asserting its absence catches
  // the regression however the query is rewritten to reintroduce it.
  it('plans the users query without any subplan', async () => {
    const queries = await runSearch('zqx');
    const plan: string = await explain(findUsersQuery(queries));

    expect(plan).not.toContain('SubPlan');
  });

  // Deliberately NOT asserted here: that either plan picks its trigram index.
  // They do on a real table — verified at 8,592 users / 8,797 auth methods,
  // where the parameterized statements this repository emits plan as Bitmap
  // Index Scans on users_displayName_trgm_idx and auth_methods_email_trgm_idx
  // — but index choice is a cost decision, and a GIN scan's startup cost loses
  // to a plain walk of a few thousand rows. This suite truncates its database
  // before every run, so pinning index selection would mean growing a fixture
  // until the planner agreed with it: a test that encodes the fixture rather
  // than the fix, and one that would flip on any future planner change. The
  // size-independent property — that the users query stands alone, with
  // nothing inside it for the planner to refuse to combine with an index — is
  // what the three assertions above pin instead.
});
