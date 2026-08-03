import type {
  ApiErrorInterface,
  StatisticsOverviewResponseInterface,
} from '@nest-aws-starter/shared';

export interface UseStatisticsOverviewResultInterface {
  readonly overview: StatisticsOverviewResponseInterface | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly reload: () => Promise<void>;
}
