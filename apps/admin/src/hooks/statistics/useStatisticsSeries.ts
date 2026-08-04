import type {
  ApiErrorInterface,
  StatisticsMetricEnum,
  StatisticsSeriesPointInterface,
  StatisticsSeriesResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchStatisticsSeries } from '../../apis/statistics';
import type { UseStatisticsSeriesResultInterface } from '../../interfaces/use-statistics-series-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useStatisticsSeries(
  metric: StatisticsMetricEnum,
  days: number,
): UseStatisticsSeriesResultInterface {
  const [points, setPoints] = useState<StatisticsSeriesPointInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result: StatisticsSeriesResponseInterface = await fetchStatisticsSeries(metric, days);

      setPoints(result.points);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [metric, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return { points, isLoading, error, reload: load };
}
