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
});
