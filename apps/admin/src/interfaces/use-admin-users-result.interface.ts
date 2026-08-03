import type { AdminUserResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';

export interface UseAdminUsersResultInterface {
  readonly users: AdminUserResponseInterface[];
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly loadMore: () => Promise<void>;
}
