import type { ApiErrorInterface, SubscriptionResponseInterface } from '@nest-aws-starter/shared';

export interface UseBillingSubscriptionResultInterface {
  readonly subscription: SubscriptionResponseInterface | null;
  readonly isLoading: boolean;
  // True once the initial load resolves PAYMENT_NO_SUBSCRIPTION — an
  // expected empty state, not a surfaced error.
  readonly isNotFound: boolean;
  readonly error: ApiErrorInterface | null;
  readonly isCanceling: boolean;
  readonly cancelError: ApiErrorInterface | null;
  readonly isOpeningPortal: boolean;
  readonly portalError: ApiErrorInterface | null;
  readonly cancel: () => Promise<void>;
  readonly openPortal: () => Promise<void>;
}
