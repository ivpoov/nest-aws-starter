import type { ApiErrorInterface, SessionResponseInterface } from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchSessions, revokeOtherSessions, revokeSession } from '../../apis/sessions';
import type { UseSessionsResultInterface } from '../../interfaces/use-sessions-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useSessions(): UseSessionsResultInterface {
  const [sessions, setSessions] = useState<SessionResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      setSessions(await fetchSessions());
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const revoke = useCallback(
    async (id: string): Promise<void> => {
      await revokeSession(id).catch((caught: unknown): void => setError(toApiError(caught)));
      await reload();
    },
    [reload],
  );

  const revokeOthers = useCallback(async (): Promise<void> => {
    await revokeOtherSessions().catch((caught: unknown): void => setError(toApiError(caught)));
    await reload();
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sessions, isLoading, error, revoke, revokeOthers };
}
