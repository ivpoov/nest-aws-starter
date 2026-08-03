import type { PrismaService } from '@modules/prisma/services/prisma.service.js';
import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
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
});
