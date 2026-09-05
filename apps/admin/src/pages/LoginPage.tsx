import type { ApiErrorInterface, AuthTokensResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { login } from '../apis/auth';
import { Brand } from '../components/Brand/Brand';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { ADMIN_HOME_ROUTE } from '../constants/admin-home-route.constants';
import { useAuthStore } from '../stores/auth.store';
import { toApiError } from '../utils/toApiError';

export function LoginPage(): ReactElement {
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);

  async function handleSubmit(): Promise<void> {
    setIsPending(true);
    setError(null);

    try {
      const tokens: AuthTokensResponseInterface = await login({ email, password });

      setTokens(tokens.accessToken, tokens.refreshToken);
      await navigate(ADMIN_HOME_ROUTE);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <Brand />
      <Card title="Admin login">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event): void => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Input label="Email" type="email" value={email} onChange={setEmail} />
          <Input label="Password" type="password" value={password} onChange={setPassword} />
          {error ? <p className="text-sm text-danger">{error.details}</p> : null}
          <Button type="submit" isDisabled={isPending}>
            Log in
          </Button>
        </form>
      </Card>
    </div>
  );
}
