import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { verifyEmail } from '../apis/auth';
import { Loader } from '../components/ui/Loader';

type VerifyStateType = 'pending' | 'done' | 'failed';

export function VerifyEmailPage(): ReactElement {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<VerifyStateType>('pending');
  const hasFiredRef = useRef<boolean>(false);

  useEffect(() => {
    const userId: string | null = searchParams.get('userId');
    const token: string | null = searchParams.get('token');

    if (!userId || !token || hasFiredRef.current) {
      if (!hasFiredRef.current) setState('failed');

      return;
    }

    hasFiredRef.current = true;

    verifyEmail({ userId, token })
      .then((): void => setState('done'))
      .catch((): void => setState('failed'));
  }, [searchParams]);

  if (state === 'pending') return <Loader />;

  return (
    <div className="mx-auto mt-16 max-w-sm text-center text-sm">
      {state === 'done' ? (
        <p>Email verified. You can close this page.</p>
      ) : (
        <p className="text-danger">This verification link is invalid or expired.</p>
      )}
      <Link to="/login" className="mt-4 inline-block text-accent">
        Go to log in
      </Link>
    </div>
  );
}
