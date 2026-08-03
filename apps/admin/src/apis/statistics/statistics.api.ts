import type {
  StatisticsMetricEnum,
  StatisticsOverviewResponseInterface,
  StatisticsSeriesResponseInterface,
} from '@nest-aws-starter/shared';
import { apiClient } from '../../utils/apiClient';

export function fetchStatisticsOverview(): Promise<StatisticsOverviewResponseInterface> {
  return apiClient.get<StatisticsOverviewResponseInterface>('/admin/statistics/overview');
}

export function fetchStatisticsSeries(
  metric: StatisticsMetricEnum,
  days: number,
): Promise<StatisticsSeriesResponseInterface> {
  const params: URLSearchParams = new URLSearchParams({ metric, days: String(days) });

  return apiClient.get<StatisticsSeriesResponseInterface>(
    `/admin/statistics/series?${params.toString()}`,
  );
}
