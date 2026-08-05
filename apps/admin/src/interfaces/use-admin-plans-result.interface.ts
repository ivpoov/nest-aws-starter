import type { AdminPlanResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';

export interface UseAdminPlansResultInterface {
  readonly plans: AdminPlanResponseInterface[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
  readonly reload: () => Promise<void>;
}
