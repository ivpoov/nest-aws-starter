import type { AdminUserResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminUsers } from '../../apis/users';
import type { UseAdminUsersResultInterface } from '../../interfaces/use-admin-users-result.interface';
import { toApiError } from '../../utils/toApiError';

const PAGE_SIZE = 20;

export function useAdminUsers(search: string): UseAdminUsersResultInterface {
  const [users, setUsers] = useState<AdminUserResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const cursorRef = useRef<string | null>(null);

  const loadPage = useCallback(
    async (isFresh: boolean): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const cursor: string | null = isFresh ? null : cursorRef.current;
        const page = await fetchAdminUsers(PAGE_SIZE, cursor, search);

        cursorRef.current = page.nextCursor;
        setHasMore(page.nextCursor !== null);
        setUsers((current: AdminUserResponseInterface[]): AdminUserResponseInterface[] =>
          isFresh ? page.items : [...current, ...page.items],
        );
      } catch (caught) {
        setError(toApiError(caught));
      } finally {
        setIsLoading(false);
      }
    },
    [search],
  );

  const loadMore = useCallback(async (): Promise<void> => loadPage(false), [loadPage]);

  useEffect(() => {
    void loadPage(true);
  }, [loadPage]);

  return { users, hasMore, isLoading, error, loadMore };
}
