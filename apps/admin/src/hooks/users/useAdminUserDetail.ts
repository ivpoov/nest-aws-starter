import type {
  AdminUserResponseInterface,
  ApiErrorInterface,
  SessionResponseInterface,
  UserStatusEnum,
} from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminUser,
  fetchAdminUserSessions,
  loginAsAdminUser,
  revokeAdminUserSessions,
  updateAdminUserStatus,
} from '../../apis/users';
import { WEB_APP_URL } from '../../constants/web-app.constants';
import type { UseAdminUserDetailResultInterface } from '../../interfaces/use-admin-user-detail-result.interface';
import { toApiError } from '../../utils/toApiError';

export function useAdminUserDetail(userId: string | null): UseAdminUserDetailResultInterface {
  const [user, setUser] = useState<AdminUserResponseInterface | null>(null);
  const [sessions, setSessions] = useState<SessionResponseInterface[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

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

  const updateStatus = useCallback(
    async (status: UserStatusEnum, reason?: string): Promise<void> => {
      if (!userId) return;

      setIsUpdatingStatus(true);

      try {
        await updateAdminUserStatus(userId, status, reason);
        await reload();
      } catch (caught) {
        setError(toApiError(caught));
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [userId, reload],
  );

  const loginAs = useCallback(async (): Promise<void> => {
    if (!userId) return;

    setIsLoggingIn(true);

    try {
      const result = await loginAsAdminUser(userId);

      window.open(`${WEB_APP_URL}/auth/callback?code=${result.code}`, '_blank', 'noopener');
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoggingIn(false);
    }
  }, [userId]);

  useEffect(() => {
    setUser(null);
    setSessions([]);
    void reload();
  }, [reload]);

  return {
    user,
    sessions,
    isLoading,
    error,
    forceLogout,
    updateStatus,
    isUpdatingStatus,
    loginAs,
    isLoggingIn,
  };
}
