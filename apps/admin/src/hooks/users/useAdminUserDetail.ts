import type {
  AdminUserResponseInterface,
  ApiErrorInterface,
  SessionResponseInterface,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchAdminUser, fetchAdminUserSessions, revokeAdminUserSessions } from '../../apis/users';
import type { UseAdminUserDetailResultInterface } from '../../interfaces/use-admin-user-detail-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useAdminUserDetail(userId: string | null): UseAdminUserDetailResultInterface {
  const [user, setUser] = useState<AdminUserResponseInterface | null>(null);
  const [sessions, setSessions] = useState<SessionResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [detail, activeSessions] = await Promise.all([
        fetchAdminUser(userId),
        fetchAdminUserSessions(userId),
      ]);

      setUser(detail);
      setSessions(activeSessions);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const forceLogout = useCallback(async (): Promise<void> => {
    if (!userId) return;

    try {
      await revokeAdminUserSessions(userId);
      await reload();
    } catch (caught) {
      setError(toApiError(caught));
    }
  }, [userId, reload]);

  useEffect(() => {
    setUser(null);
    setSessions([]);
    void reload();
  }, [reload]);

  return { user, sessions, isLoading, error, forceLogout };
}
