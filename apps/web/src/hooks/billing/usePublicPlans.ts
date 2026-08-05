import type {
  ApiErrorInterface,
  PublicPlanResponseInterface,
  PublicPlansResponseInterface,
} from '@nest-aws-starter/shared';
import { useEffect, useState } from 'react';
import { fetchPublicPlans } from '../../apis/billing';
import type { UsePublicPlansResultInterface } from '../../interfaces/use-public-plans-result.interface';
import { toApiError } from '../../utils/toApiError';

export function usePublicPlans(): UsePublicPlansResultInterface {
  const [plans, setPlans] = useState<PublicPlanResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  useEffect(() => {
    fetchPublicPlans()
      .then((response: PublicPlansResponseInterface): void => setPlans(response.items))
      .catch((caught: unknown): void => setError(toApiError(caught)))
      .finally((): void => setIsLoading(false));
  }, []);

  return { plans, isLoading, error };
}
