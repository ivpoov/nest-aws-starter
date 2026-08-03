import { buildStatisticSeriesCacheKey } from '@modules/statistic/constants/statistic-cache-key.constants.js';
import type { StatisticRepositoryInterface } from '@modules/statistic/interfaces/statistic-repository.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
import { StatisticService } from '@modules/statistic/services/statistic.service.js';
import type { StatisticCacheService } from '@modules/statistic/services/statistic-cache.service.js';
import type { OnlineUsersService } from '@modules/token/services/online-users.service.js';
import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import { describe, expect, it, vi } from 'vitest';

const registrationPoints: StatisticsDayPointInterface[] = [
  { date: '2026-08-01', count: 2 },
  { date: '2026-08-02', count: 5 },
];

const newDevicePoints: StatisticsDayPointInterface[] = [{ date: '2026-08-02', count: 1 }];

interface TestSetupInterface {
  readonly service: StatisticService;
  readonly repository: StatisticRepositoryInterface;
  readonly cache: StatisticCacheService;
  readonly onlineUsersService: OnlineUsersService;
}

function createService(overrides: Partial<StatisticRepositoryInterface> = {}): TestSetupInterface {
  const repository: StatisticRepositoryInterface = {
    findUsersByStatus: vi.fn().mockResolvedValue([
      { key: 'ACTIVE', count: 8 },
      { key: 'BLOCKED', count: 2 },
    ]),
    findAuthMethodDistribution: vi.fn().mockResolvedValue([{ key: 'EMAIL', count: 10 }]),
    countActiveSessions: vi.fn().mockResolvedValue(4),
    findRegistrationsByDay: vi.fn().mockResolvedValue(registrationPoints),
    findNewDevicesByDay: vi.fn().mockResolvedValue(newDevicePoints),
    ...overrides,
  };
  // The cache is a pass-through: unit tests assert the key/ttl passed in and
  // that a miss runs the factory — actual store behaviour is CacheService's.
  const cache: StatisticCacheService = {
    wrap: vi.fn((_key: string, _ttlMs: number, factory: () => Promise<unknown>) => factory()),
  } as unknown as StatisticCacheService;
  const onlineUsersService: OnlineUsersService = {
    countActive: vi.fn().mockResolvedValue(3),
  } as unknown as OnlineUsersService;
  const service: StatisticService = new StatisticService(repository, cache, onlineUsersService);

  return { service, repository, cache, onlineUsersService };
}

describe('StatisticService', () => {
  it('composes the overview payload from every source query', async () => {
    const { service, onlineUsersService } = createService();

    const overview = await service.getOverview();

    expect(overview.totals).toEqual({
      users: 10,
      activeSessions: 4,
      onlineNow: 3,
      newToday: 2,
      revenue: null,
    });
    expect(overview.usersByStatus).toEqual([
      { key: 'ACTIVE', count: 8 },
      { key: 'BLOCKED', count: 2 },
    ]);
    expect(overview.authMethodDistribution).toEqual([{ key: 'EMAIL', count: 10 }]);
    expect(onlineUsersService.countActive).toHaveBeenCalledWith(300);
  });

  it('wraps the overview under the fixed overview cache key with a 60s ttl', async () => {
    const { service, cache } = createService();

    await service.getOverview();

    expect(cache.wrap).toHaveBeenCalledWith('statistic:overview', 60_000, expect.any(Function));
  });

  it('maps registration day points to metric series points', async () => {
    const { service, repository } = createService();

    const series = await service.getSeries(StatisticsMetricEnum.REGISTRATIONS, 2);

    expect(repository.findRegistrationsByDay).toHaveBeenCalledWith(2);
    expect(series).toEqual({
      metric: StatisticsMetricEnum.REGISTRATIONS,
      days: 2,
      points: [
        { date: '2026-08-01', value: 2 },
        { date: '2026-08-02', value: 5 },
      ],
    });
  });

  it('dispatches NEW_DEVICES to the new-devices query and caches by metric+days', async () => {
    const { service, repository, cache } = createService();

    const series = await service.getSeries(StatisticsMetricEnum.NEW_DEVICES, 1);

    expect(repository.findNewDevicesByDay).toHaveBeenCalledWith(1);
    expect(repository.findRegistrationsByDay).not.toHaveBeenCalled();
    expect(series.points).toEqual([{ date: '2026-08-02', value: 1 }]);
    expect(cache.wrap).toHaveBeenCalledWith(
      buildStatisticSeriesCacheKey(StatisticsMetricEnum.NEW_DEVICES, 1),
      300_000,
      expect.any(Function),
    );
  });
});
