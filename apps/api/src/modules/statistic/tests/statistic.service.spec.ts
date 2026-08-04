import { buildStatisticSeriesCacheKey } from '@modules/statistic/constants/statistic-cache-key.constants.js';
import type { StatisticRepositoryInterface } from '@modules/statistic/interfaces/statistic-repository.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
import type { StatisticsRevenueByPlanRowInterface } from '@modules/statistic/interfaces/statistics-revenue-by-plan-row.interface.js';
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

const revenuePoints: StatisticsDayPointInterface[] = [
  { date: '2026-08-01', count: 1000 },
  { date: '2026-08-02', count: 500 },
];

const revenueByPlanRows: StatisticsRevenueByPlanRowInterface[] = [
  { planId: 'plan-1', planName: 'Pro', amountCents: 1500 },
];

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
    findRevenueByDay: vi.fn().mockResolvedValue(revenuePoints),
    findMrrCents: vi.fn().mockResolvedValue(4_900),
    findRevenueByPlan: vi.fn().mockResolvedValue(revenueByPlanRows),
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

    expect(overview.totals.users).toBe(10);
    expect(overview.totals.activeSessions).toBe(4);
    expect(overview.totals.onlineNow).toBe(3);
    expect(overview.totals.newToday).toBe(2);
    expect(overview.usersByStatus).toEqual([
      { key: 'ACTIVE', count: 8 },
      { key: 'BLOCKED', count: 2 },
    ]);
    expect(overview.authMethodDistribution).toEqual([{ key: 'EMAIL', count: 10 }]);
    expect(onlineUsersService.countActive).toHaveBeenCalledWith(300);
  });

  // <module:payment>
  it('composes revenue, mrr, and revenue-by-plan into the overview when payment is present', async () => {
    const { service } = createService();

    const overview = await service.getOverview();

    expect(overview.totals.revenue).toBe(1500);
    expect(overview.totals.mrrCents).toBe(4_900);
    expect(overview.revenueByPlan).toEqual(revenueByPlanRows);
  });

  it('sums revenue over the trailing 30-day window and passes the reporting currency window', async () => {
    const { service, repository } = createService();

    await service.getOverview();

    expect(repository.findRevenueByDay).toHaveBeenCalledWith(30);
    expect(repository.findRevenueByPlan).toHaveBeenCalledWith(30);
    expect(repository.findMrrCents).toHaveBeenCalledWith();
  });
  // </module:payment>

  it('defaults revenue, mrr, and revenue-by-plan to the v0.3-stub shape when the revenue capability is unavailable', async () => {
    const { service } = createService();

    // Simulates the payment-subtracted build — see the guard tests below
    // for why this is the only way to unit-test that state.
    (service as unknown as { revenueAvailable: boolean }).revenueAvailable = false;

    const overview = await service.getOverview();

    expect(overview.totals.revenue).toBeNull();
    expect(overview.totals.mrrCents).toBeNull();
    expect(overview.revenueByPlan).toEqual([]);
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

  // <module:payment>
  it('dispatches REVENUE to the revenue-by-day query', async () => {
    const { service, repository } = createService();

    const series = await service.getSeries(StatisticsMetricEnum.REVENUE, 2);

    expect(repository.findRevenueByDay).toHaveBeenCalledWith(2);
    expect(repository.findRegistrationsByDay).not.toHaveBeenCalled();
    expect(series).toEqual({
      metric: StatisticsMetricEnum.REVENUE,
      days: 2,
      points: [
        { date: '2026-08-01', value: 1000 },
        { date: '2026-08-02', value: 500 },
      ],
    });
  });
  // </module:payment>

  it('rejects REVENUE with a coded 400 instead of substituting registrations when the revenue capability is unavailable', async () => {
    const { service, repository } = createService();

    // Simulates the payment-subtracted build: the fenced constructor line
    // that flips this flag true is stripped along with the payment module
    // (see StatisticService.revenueAvailable / scripts/subtraction-test.mjs).
    // There is no public API to construct that state — this is the only way
    // to unit-test the guard without standing up the subtracted worktree.
    (service as unknown as { revenueAvailable: boolean }).revenueAvailable = false;

    await expect(service.getSeries(StatisticsMetricEnum.REVENUE, 7)).rejects.toMatchObject({
      args: { code: 'STATISTIC_REVENUE_UNAVAILABLE' },
    });
    expect(repository.findRegistrationsByDay).not.toHaveBeenCalled();
    expect(repository.findRevenueByDay).not.toHaveBeenCalled();
  });

  it('still serves REGISTRATIONS and NEW_DEVICES when the revenue capability is unavailable', async () => {
    const { service, repository } = createService();

    (service as unknown as { revenueAvailable: boolean }).revenueAvailable = false;

    await expect(service.getSeries(StatisticsMetricEnum.REGISTRATIONS, 2)).resolves.toBeDefined();
    await expect(service.getSeries(StatisticsMetricEnum.NEW_DEVICES, 1)).resolves.toBeDefined();
    expect(repository.findRegistrationsByDay).toHaveBeenCalledWith(2);
    expect(repository.findNewDevicesByDay).toHaveBeenCalledWith(1);
  });
});
