import type { ApiErrorInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Button } from './Button';

interface ErrorMessagePropsInterface {
  readonly error: ApiErrorInterface;
  readonly onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessagePropsInterface): ReactElement {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 p-4 text-sm">
      <p className="text-danger">{error.details}</p>
      {onRetry ? (
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
