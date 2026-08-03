import type { ApiErrorInterface } from '@nest-aws-starter/shared';

export interface UseRequestStateInterface {
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
}
