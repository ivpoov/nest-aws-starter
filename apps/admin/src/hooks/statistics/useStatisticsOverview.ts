import type {
  ApiErrorInterface,
  StatisticsOverviewResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchStatisticsOverview } from '../../apis/statistics';
import type { UseStatisticsOverviewResultInterface } from '../../interfaces/use-statistics-overview-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useStatisticsOverview(): UseStatisticsOverviewResultInterface {
  const [overview, setOverview] = useState<StatisticsOverviewResponseInterface | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const result: StatisticsOverviewResponseInterface = await fetchStatisticsOverview();

      setOverview(result);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { overview, isLoading, error, reload: load };
}
