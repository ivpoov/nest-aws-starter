import type { ApiErrorInterface, CheckoutResponseInterface } from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import { createCheckoutSession } from '../../apis/billing';
import type { UseCheckoutResultInterface } from '../../interfaces/use-checkout-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useCheckout(): UseCheckoutResultInterface {
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const startCheckout = useCallback(async (planId: string): Promise<void> => {
    setPendingPlanId(planId);
    setError(null);

    try {
      const session: CheckoutResponseInterface = await createCheckoutSession({ planId });

      window.location.href = session.url;
    } catch (caught) {
      setError(toApiError(caught));
      setPendingPlanId(null);
    }
  }, []);

  return { pendingPlanId, error, startCheckout };
}
