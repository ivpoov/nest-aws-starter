import type { ActivityResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';

export interface UseActivityListResultInterface {
  readonly activities: ActivityResponseInterface[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
}
