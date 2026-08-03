import type { AuthMethodTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useProviders } from '../../hooks/auth/useProviders';
import { oauthStartUrl } from '../../utils/oauthStartUrl';

interface ProviderButtonsPropsInterface {
  readonly intent: 'login' | 'link';
}

export function ProviderButtons({ intent }: ProviderButtonsPropsInterface): ReactElement | null {
  const { providers, isLoading } = useProviders();

  if (isLoading || providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {providers.map((provider: AuthMethodTypeEnum) => (
        <a
          key={provider}
          href={oauthStartUrl(provider, intent)}
          className="rounded-lg border border-edge px-4 py-2 text-center text-sm hover:bg-surface"
        >
          Continue with {provider.charAt(0) + provider.slice(1).toLowerCase()}
        </a>
      ))}
    </div>
  );
}
