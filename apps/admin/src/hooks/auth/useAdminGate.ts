import type { UserResponseInterface } from '@nest-aws-starter/shared';
import { useEffect, useState } from 'react';
import { fetchMe } from '../../apis/users';
import type { UseAdminGateResultInterface } from '../../interfaces/use-admin-gate-result.interface';
import { useAuthStore } from '../../stores/auth.store';

// Resolves the caller's role once per app load: the gate cannot trust
// localStorage alone, the API is the authority.
export function useAdminGate(): UseAdminGateResultInterface {
  const accessToken: string | null = useAuthStore((state) => state.accessToken);
  const user: UserResponseInterface | null = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clear);
  const [isResolving, setIsResolving] = useState<boolean>(accessToken !== null && user === null);

  useEffect(() => {
    if (!accessToken || user) return;

    fetchMe()
      .then((me: UserResponseInterface): void => setUser(me))
      .catch((): void => clear())
      .finally((): void => setIsResolving(false));
  }, [accessToken, user, setUser, clear]);

  return {
    isAuthenticated: accessToken !== null,
    isResolving,
    role: user?.role ?? null,
  };
}
