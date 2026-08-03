import { useMemo } from 'react';
import type { AccessTokenClaimsInterface } from '../../interfaces/access-token-claims.interface';
import { useAuthStore } from '../../stores/auth.store';
import { decodeJwtPayload } from '../../utils/decodeJwt';

export function useIsImpersonating(): boolean {
  const accessToken: string | null = useAuthStore((state) => state.accessToken);

  return useMemo((): boolean => {
    if (!accessToken) return false;

    const claims: AccessTokenClaimsInterface | null =
      decodeJwtPayload<AccessTokenClaimsInterface>(accessToken);

    return Boolean(claims?.actAsBy);
  }, [accessToken]);
}
