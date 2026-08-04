import type { StatisticsMetricEnum } from '@nest-aws-starter/shared';

export const STATISTIC_OVERVIEW_CACHE_KEY = 'statistic:overview';

export function buildStatisticSeriesCacheKey(metric: StatisticsMetricEnum, days: number): string {
  return `statistic:series:${metric}:${days}`;
}
