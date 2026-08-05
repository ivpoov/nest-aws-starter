import type {
  ApiErrorInterface,
  CheckoutResponseInterface,
  SubscriptionResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  cancelSubscription,
  createPortalSession,
  fetchCurrentSubscription,
} from '../../apis/billing';
import { PAYMENT_NO_SUBSCRIPTION_CODE } from '../../constants/billing.constants';
import type { UseBillingSubscriptionResultInterface } from '../../interfaces/use-billing-subscription-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useBillingSubscription(): UseBillingSubscriptionResultInterface {
  const [subscription, setSubscription] = useState<SubscriptionResponseInterface | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<ApiErrorInterface | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState<boolean>(false);
  const [portalError, setPortalError] = useState<ApiErrorInterface | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      setSubscription(await fetchCurrentSubscription());
    } catch (caught) {
      const apiError: ApiErrorInterface = toApiError(caught);

      if (apiError.code === PAYMENT_NO_SUBSCRIPTION_CODE) {
        setSubscription(null);
        setIsNotFound(true);
      } else {
        setError(apiError);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    setIsCanceling(true);
    setCancelError(null);

    try {
      setSubscription(await cancelSubscription());
    } catch (caught) {
      setCancelError(toApiError(caught));
    } finally {
      setIsCanceling(false);
    }
  }, []);

  const openPortal = useCallback(async (): Promise<void> => {
    setIsOpeningPortal(true);
    setPortalError(null);

    try {
      const session: CheckoutResponseInterface = await createPortalSession();

      window.location.href = session.url;
    } catch (caught) {
      setPortalError(toApiError(caught));
      setIsOpeningPortal(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    subscription,
    isLoading,
    isNotFound,
    error,
    isCanceling,
    cancelError,
    isOpeningPortal,
    portalError,
    cancel,
    openPortal,
  };
}
