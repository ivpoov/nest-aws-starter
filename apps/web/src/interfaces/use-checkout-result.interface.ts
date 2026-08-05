import type { ApiErrorInterface } from '@nest-aws-starter/shared';

export interface UseCheckoutResultInterface {
  readonly pendingPlanId: string | null;
  readonly error: ApiErrorInterface | null;
  readonly startCheckout: (planId: string) => Promise<void>;
}
