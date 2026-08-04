import type { ApiErrorInterface, PublicPlanResponseInterface } from '@nest-aws-starter/shared';

export interface UsePublicPlansResultInterface {
  readonly plans: PublicPlanResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
}
