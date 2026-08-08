import type { ApiErrorInterface, AuthTokensResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { register } from '../apis/auth';
import { ProviderButtons } from '../components/Auth/ProviderButtons';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../stores/auth.store';
import { toApiError } from '../utils/toApiError';

export function RegisterPage(): ReactElement {
  const navigate = useNavigate();
  const setTokens = useAuthStore((state) => state.setTokens);
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<ApiErrorInterface | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);

  async function handleSubmit(): Promise<void> {
    setIsPending(true);
    setError(null);

    try {
      const tokens: AuthTokensResponseInterface = await register({ displayName, email, password });

      setTokens(tokens.accessToken, tokens.refreshToken);
      await navigate('/notes');
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card title="Create account">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event): void => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Input label="Name" value={displayName} onChange={setDisplayName} />
          <Input label="Email" type="email" value={email} onChange={setEmail} />
          <Input label="Password" type="password" value={password} onChange={setPassword} />
          {error ? <p className="text-sm text-danger">{error.details}</p> : null}
          <Button type="submit" isDisabled={isPending}>
            Register
          </Button>
        </form>
        <div className="mt-4 flex flex-col gap-3">
          <ProviderButtons intent="login" />
          <p className="text-center text-sm text-content-muted">
            <Link to="/login" className="hover:text-content">
              Already have an account?
            </Link>
            {' · '}
            {/* <module:payment> */}
            <Link to="/pricing" className="hover:text-content">
              Pricing
            </Link>
            {' · '}
            {/* </module:payment> */}
            <Link to="/contact" className="hover:text-content">
              Contact us
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
