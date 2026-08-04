import { STATISTIC_REPOSITORY } from '@modules/statistic/constants/statistic.constants.js';
import {
  buildStatisticSeriesCacheKey,
  STATISTIC_OVERVIEW_CACHE_KEY,
} from '@modules/statistic/constants/statistic-cache-key.constants.js';
import {
  STATISTIC_ONLINE_WINDOW_SEC,
  STATISTIC_OVERVIEW_CACHE_TTL_MS,
  STATISTIC_SERIES_CACHE_TTL_MS,
} from '@modules/statistic/constants/statistic-cache-ttl.constants.js';
import type { StatisticRepositoryInterface } from '@modules/statistic/interfaces/statistic-repository.interface.js';
import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
import type { StatisticsOverviewInterface } from '@modules/statistic/interfaces/statistics-overview.interface.js';
import type { StatisticsSeriesInterface } from '@modules/statistic/interfaces/statistics-series.interface.js';
import type { StatisticsSeriesPointInterface } from '@modules/statistic/interfaces/statistics-series-point.interface.js';
import { StatisticCacheService } from '@modules/statistic/services/statistic-cache.service.js';
import { OnlineUsersService } from '@modules/token/services/online-users.service.js';
import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class StatisticService {
  constructor(
    @Inject(STATISTIC_REPOSITORY)
    private readonly statisticRepository: StatisticRepositoryInterface,
    private readonly statisticCache: StatisticCacheService,
    private readonly onlineUsersService: OnlineUsersService,
  ) {}

  public getOverview(): Promise<StatisticsOverviewInterface> {
    return this.statisticCache.wrap(
      STATISTIC_OVERVIEW_CACHE_KEY,
      STATISTIC_OVERVIEW_CACHE_TTL_MS,
      (): Promise<StatisticsOverviewInterface> => this.composeOverview(),
    );
  }

  public getSeries(metric: StatisticsMetricEnum, days: number): Promise<StatisticsSeriesInterface> {
    const key: string = buildStatisticSeriesCacheKey(metric, days);

    return this.statisticCache.wrap(
      key,
      STATISTIC_SERIES_CACHE_TTL_MS,
      (): Promise<StatisticsSeriesInterface> => this.composeSeries(metric, days),
    );
  }

  private async composeOverview(): Promise<StatisticsOverviewInterface> {
    const [usersByStatus, authMethodDistribution, activeSessions, today, onlineNow] =
      await Promise.all([
        this.statisticRepository.findUsersByStatus(),
        this.statisticRepository.findAuthMethodDistribution(),
        this.statisticRepository.countActiveSessions(),
        this.statisticRepository.findRegistrationsByDay(1),
        this.onlineUsersService.countActive(STATISTIC_ONLINE_WINDOW_SEC),
      ]);

    return {
      totals: {
        users: this.sumCounts(usersByStatus),
        activeSessions,
        onlineNow,
        newToday: today[0]?.count ?? 0,
        revenue: null,
      },
      usersByStatus,
      authMethodDistribution,
    };
  }

  private async composeSeries(
    metric: StatisticsMetricEnum,
    days: number,
  ): Promise<StatisticsSeriesInterface> {
    const dayPoints: StatisticsDayPointInterface[] = await this.fetchSeriesPoints(metric, days);
    const points: StatisticsSeriesPointInterface[] = dayPoints.map(
      (point: StatisticsDayPointInterface): StatisticsSeriesPointInterface => ({
        date: point.date,
        value: point.count,
      }),
    );

    return { metric, days, points };
  }

  private fetchSeriesPoints(
    metric: StatisticsMetricEnum,
    days: number,
  ): Promise<StatisticsDayPointInterface[]> {
    if (metric === StatisticsMetricEnum.NEW_DEVICES) {
      return this.statisticRepository.findNewDevicesByDay(days);
    }

    return this.statisticRepository.findRegistrationsByDay(days);
  }

  private sumCounts(rows: StatisticsCountRowInterface[]): number {
    return rows.reduce(
      (total: number, row: StatisticsCountRowInterface): number => total + row.count,
      0,
    );
  }
}
