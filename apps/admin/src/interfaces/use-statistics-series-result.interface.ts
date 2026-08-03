import type { ApiErrorInterface, StatisticsSeriesPointInterface } from '@nest-aws-starter/shared';

export interface UseStatisticsSeriesResultInterface {
  readonly points: StatisticsSeriesPointInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly reload: () => Promise<void>;
}
