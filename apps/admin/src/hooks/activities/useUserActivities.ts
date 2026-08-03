import type { ActivityResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUserActivities } from '../../apis/activities';
import type { UseActivityListResultInterface } from '../../interfaces/use-activity-list-result.interface';
import { toApiError } from '../../utils/toApiError';

const PAGE_SIZE = 20;

export function useUserActivities(userId: string | null): UseActivityListResultInterface {
  const [activities, setActivities] = useState<ActivityResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const cursorRef = useRef<string | null>(null);

  const loadPage = useCallback(
    async (isFresh: boolean): Promise<void> => {
      if (!userId) return;

      setIsLoading(true);
      setError(null);

      try {
        const cursor: string | null = isFresh ? null : cursorRef.current;
        const page = await fetchUserActivities(userId, PAGE_SIZE, cursor);

        cursorRef.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
        setActivities((current: ActivityResponseInterface[]): ActivityResponseInterface[] =>
          isFresh ? page.items : [...current, ...page.items],
        );
      } catch (caught) {
        setError(toApiError(caught));
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  const loadMore = useCallback(async (): Promise<void> => loadPage(false), [loadPage]);

  useEffect(() => {
    setActivities([]);
    cursorRef.current = null;
    void loadPage(true);
  }, [loadPage]);

  return { activities, hasMore, isLoading, error, loadMore };
}
