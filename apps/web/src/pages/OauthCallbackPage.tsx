import type { OauthExchangeResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { exchangeOauthCode } from '../apis/auth';
import { Loader } from '../components/ui/Loader';
import { useAuthStore } from '../stores/auth.store';
import { logger } from '../utils/logger';

export function OauthCallbackPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((state) => state.setTokens);
  const [failure, setFailure] = useState<string | null>(searchParams.get('error'));
  const hasFiredRef = useRef<boolean>(false);

  useEffect(() => {
    const code: string | null = searchParams.get('code');

    if (!code || hasFiredRef.current) return;

    hasFiredRef.current = true;

    exchangeOauthCode(code)
      .then(async (result: OauthExchangeResponseInterface): Promise<void> => {
        if (result.tokens) setTokens(result.tokens.accessToken, result.tokens.refreshToken);

        await navigate(result.kind === 'LINK' ? '/settings/methods' : '/notes');
      })
      .catch((caught: unknown): void => {
        logger.warn('OAuth exchange failed', caught);
        setFailure('OAUTH_EXCHANGE_CODE_INVALID');
      });
  }, [searchParams, setTokens, navigate]);

  if (failure) {
    return (
      <div className="mx-auto mt-16 max-w-sm text-center text-sm">
        <p className="text-danger">Sign-in was not completed ({failure}).</p>
        <Link to="/login" className="mt-4 inline-block text-accent">
          Back to log in
        </Link>
      </div>
    );
  }

  return <Loader />;
}
