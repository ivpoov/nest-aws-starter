import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { forgotPassword } from '../apis/auth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { logger } from '../utils/logger';

export function ForgotPasswordPage(): ReactElement {
  const [email, setEmail] = useState<string>('');
  const [isSent, setIsSent] = useState<boolean>(false);

  async function handleSubmit(): Promise<void> {
    // Always 204 server-side — no user enumeration, so no error branch here.
    await forgotPassword({ email }).catch((caught: unknown): void =>
      logger.warn('Forgot password request failed', caught),
    );
    setIsSent(true);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <Card title="Reset password">
        {isSent ? (
          <p className="text-sm">If that address exists, a reset link is on its way.</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event): void => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <Input label="Email" type="email" value={email} onChange={setEmail} />
            <Button type="submit" isDisabled={!email}>
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm text-content-muted">
          <Link to="/login" className="hover:text-content">
            Back to log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
