import { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
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
