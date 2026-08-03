import type { ApiErrorInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { resetPassword } from '../apis/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { toApiError } from '../utils/toApiError';

export function ResetPasswordPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<ApiErrorInterface | null>(null);

  async function handleSubmit(): Promise<void> {
    setError(null);

    try {
      await resetPassword({
        userId: searchParams.get('userId') ?? '',
        token: searchParams.get('token') ?? '',
        password,
      });
      await navigate('/login');
    } catch (caught) {
      setError(toApiError(caught));
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card title="Choose a new password">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event): void => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Input label="New password" type="password" value={password} onChange={setPassword} />
          {error ? <p className="text-sm text-danger">{error.details}</p> : null}
          <Button type="submit" isDisabled={password.length < 8}>
            Set password
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-content-muted">
          <Link to="/login" className="hover:text-content">
            Back to log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
