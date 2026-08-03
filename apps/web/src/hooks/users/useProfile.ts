import type { ApiErrorInterface, UserResponseInterface } from '@nest-aws-starter/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchMe, updateMe, uploadAvatar as uploadAvatarRequest } from '../../apis/users';
import type { UseProfileResultInterface } from '../../interfaces/use-profile-result.interface';
import { useAuthStore } from '../../stores/auth.store';
import { toApiError } from '../../utils/toApiError';

export function useProfile(): UseProfileResultInterface {
  const [profile, setProfile] = useState<UserResponseInterface | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const setUser = useAuthStore((state) => state.setUser);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const me: UserResponseInterface = await fetchMe();

      setProfile(me);
      setUser(me);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  const rename = useCallback(
    async (displayName: string): Promise<void> => {
      try {
        const me: UserResponseInterface = await updateMe({ displayName });

        setProfile(me);
        setUser(me);
      } catch (caught) {
        setError(toApiError(caught));
      }
    },
    [setUser],
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<void> => {
      try {
        await uploadAvatarRequest(file);
        await reload();
      } catch (caught) {
        setError(toApiError(caught));
      }
    },
    [reload],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, isLoading, error, rename, uploadAvatar };
}
