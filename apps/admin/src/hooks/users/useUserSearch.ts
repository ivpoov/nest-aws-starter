import type { AdminUserResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';
import { useCallback, useState } from 'react';
import { fetchAdminUsers } from '../../apis/users';
import type { UseUserSearchResultInterface } from '../../interfaces/use-user-search-result.interface';
import { toApiError } from '../../utils/toApiError';

const RESULT_LIMIT = 5;

export function useUserSearch(): UseUserSearchResultInterface {
  const [results, setResults] = useState<AdminUserResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const search = useCallback(async (query: string): Promise<void> => {
    if (!query) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const page = await fetchAdminUsers(RESULT_LIMIT, null, query);

      setResults(page.items);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback((): void => {
    setResults([]);
    setError(null);
  }, []);

  return { results, isLoading, error, search, clear };
}
