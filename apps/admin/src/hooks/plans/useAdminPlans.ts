import type { AdminPlanResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminPlans } from '../../apis/plans';
import type { UseAdminPlansResultInterface } from '../../interfaces/use-admin-plans-result.interface';
import { toApiError } from '../../utils/toApiError';

const PAGE_SIZE = 20;

export function useAdminPlans(): UseAdminPlansResultInterface {
  const [plans, setPlans] = useState<AdminPlanResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const cursorRef = useRef<string | null>(null);

  const loadPage = useCallback(async (isFresh: boolean): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const cursor: string | null = isFresh ? null : cursorRef.current;
      const page = await fetchAdminPlans(PAGE_SIZE, cursor);

      cursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor !== null);
      setPlans((current: AdminPlanResponseInterface[]): AdminPlanResponseInterface[] =>
        isFresh ? page.items : [...current, ...page.items],
      );
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (): Promise<void> => loadPage(false), [loadPage]);
  const reload = useCallback(async (): Promise<void> => loadPage(true), [loadPage]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  return { plans, hasMore, isLoading, error, loadMore, reload };
}
