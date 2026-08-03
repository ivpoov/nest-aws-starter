import type { AuthMethodTypeEnum, OauthProvidersResponseInterface } from '@nest-aws-starter/shared';
import { useEffect, useState } from 'react';
import { fetchProviders } from '../../apis/auth';
import type { UseProvidersResultInterface } from '../../interfaces/use-providers-result.interface';
import { logger } from '../../utils/logger';

export function useProviders(): UseProvidersResultInterface {
  const [providers, setProviders] = useState<AuthMethodTypeEnum[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchProviders()
      .then((response: OauthProvidersResponseInterface): void => setProviders(response.providers))
      .catch((caught: unknown): void => logger.warn('Providers unavailable', caught))
      .finally((): void => setIsLoading(false));
  }, []);

  return { providers, isLoading };
}
