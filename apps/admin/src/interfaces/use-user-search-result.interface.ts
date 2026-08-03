import type { AdminUserResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';

export interface UseUserSearchResultInterface {
  readonly results: AdminUserResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly search: (query: string) => Promise<void>;
  readonly clear: () => void;
}
