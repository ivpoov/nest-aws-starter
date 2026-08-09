import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
// <module:payment>
import type { StatisticsRevenueByPlanRowInterface } from '@modules/statistic/interfaces/statistics-revenue-by-plan-row.interface.js';
// </module:payment>
import { StatisticTypedSqlRepository } from '@modules/statistic/repositories/statistic-typed-sql.repository.js';
import { describe, expect, it, vi } from 'vitest';

// Repository unit tests mock only $queryRawTyped — the one Prisma surface a
// repository may touch — to prove row -> domain mapping, never a real DB.
function createRepository(rows: unknown[]): {
  repository: StatisticTypedSqlRepository;
  queryRawTyped: ReturnType<typeof vi.fn>;
} {
  const queryRawTyped = vi.fn().mockResolvedValue(rows);
  const prisma = { $queryRawTyped: queryRawTyped } as unknown as PrismaService;
  const repository: StatisticTypedSqlRepository = new StatisticTypedSqlRepository(prisma);

  return { repository, queryRawTyped };
}

describe('StatisticTypedSqlRepository', () => {
  it('maps usersByStatus rows, defaulting null counts to zero', async () => {
    const { repository } = createRepository([
      { status: 'ACTIVE', count: 8 },
      { status: 'BLOCKED', count: null },
    ]);

    const rows: StatisticsCountRowInterface[] = await repository.findUsersByStatus();

    expect(rows).toEqual([
      { key: 'ACTIVE', count: 8 },
      { key: 'BLOCKED', count: 0 },
    ]);
  });

  it('maps authMethodDistribution rows', async () => {
    const { repository } = createRepository([{ type: 'EMAIL', count: 12 }]);

    const rows: StatisticsCountRowInterface[] = await repository.findAuthMethodDistribution();

    expect(rows).toEqual([{ key: 'EMAIL', count: 12 }]);
  });

  it('reads the single activeSessionsCount row, defaulting a missing row to zero', async () => {
    const { repository } = createRepository([]);

    const count: number = await repository.countActiveSessions();

    expect(count).toBe(0);
  });

  it('formats registrationsByDay rows as YYYY-MM-DD points', async () => {
    const { repository, queryRawTyped } = createRepository([
      { day: new Date('2026-08-01T00:00:00.000Z'), count: 3 },
      { day: new Date('2026-08-02T00:00:00.000Z'), count: null },
    ]);

    const points: StatisticsDayPointInterface[] = await repository.findRegistrationsByDay(2);

    expect(points).toEqual([
      { date: '2026-08-01', count: 3 },
      { date: '2026-08-02', count: 0 },
    ]);
    expect(queryRawTyped).toHaveBeenCalledOnce();
  });

  it('formats newDevicesByDay rows as YYYY-MM-DD points', async () => {
    const { repository } = createRepository([
      { day: new Date('2026-08-03T00:00:00.000Z'), count: 1 },
    ]);

    const points: StatisticsDayPointInterface[] = await repository.findNewDevicesByDay(1);

    expect(points).toEqual([{ date: '2026-08-03', count: 1 }]);
  });

  // <module:payment>
  it('formats revenueByDay rows as YYYY-MM-DD points, defaulting null amounts to zero', async () => {
    const { repository, queryRawTyped } = createRepository([
      { day: new Date('2026-08-01T00:00:00.000Z'), amountCents: 2_000n },
      { day: new Date('2026-08-02T00:00:00.000Z'), amountCents: null },
    ]);

    const points: StatisticsDayPointInterface[] = await repository.findRevenueByDay(2);

    expect(points).toEqual([
      { date: '2026-08-01', count: 2_000 },
      { date: '2026-08-02', count: 0 },
    ]);
    expect(queryRawTyped).toHaveBeenCalledOnce();
  });

  it('reads the single mrrCurrent row, converting bigint cents to a number', async () => {
    const { repository } = createRepository([{ mrrCents: 4_900n }]);

    const mrrCents: number = await repository.findMrrCents();

    expect(mrrCents).toBe(4_900);
  });

  it('defaults mrrCurrent to zero when no active subscriptions exist', async () => {
    const { repository } = createRepository([]);

    const mrrCents: number = await repository.findMrrCents();

    expect(mrrCents).toBe(0);
  });

  it('maps revenueByPlan rows, defaulting null amounts to zero', async () => {
    const { repository } = createRepository([
      { planId: 'plan-1', planName: 'Pro', amountCents: 3_000n },
      { planId: 'plan-2', planName: 'Basic', amountCents: null },
    ]);

    const rows: StatisticsRevenueByPlanRowInterface[] = await repository.findRevenueByPlan(30);

    expect(rows).toEqual([
      { planId: 'plan-1', planName: 'Pro', amountCents: 3_000 },
      { planId: 'plan-2', planName: 'Basic', amountCents: 0 },
    ]);
  });

  // Regression guard for the int32 cast these queries used to carry: any
  // bucket past 2_147_483_647 cents (~$21.5M) made Postgres raise `integer
  // out of range` and 500 the whole endpoint. The aggregates are bigint now,
  // so the repository has to carry bigint through to the JSON number.
  it('maps revenue amounts above the int32 boundary without loss', async () => {
    const aboveInt32Max: bigint = 2_147_483_648n;
    const { repository } = createRepository([
      { day: new Date('2026-08-01T00:00:00.000Z'), amountCents: aboveInt32Max },
      { day: new Date('2026-08-02T00:00:00.000Z'), amountCents: 9_000_000_000_000n },
    ]);

    const points: StatisticsDayPointInterface[] = await repository.findRevenueByDay(2);

    expect(points).toEqual([
      { date: '2026-08-01', count: 2_147_483_648 },
      { date: '2026-08-02', count: 9_000_000_000_000 },
    ]);
  });

  it('clamps revenue beyond the safe-integer ceiling instead of silently rounding', async () => {
    const { repository } = createRepository([
      { planId: 'plan-1', planName: 'Pro', amountCents: BigInt(Number.MAX_SAFE_INTEGER) + 10n },
    ]);

    const rows: StatisticsRevenueByPlanRowInterface[] = await repository.findRevenueByPlan(30);

    expect(rows[0]?.amountCents).toBe(Number.MAX_SAFE_INTEGER);
  });
  // </module:payment>
});
