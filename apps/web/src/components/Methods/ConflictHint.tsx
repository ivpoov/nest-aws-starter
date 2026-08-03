import type { ApiErrorInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';

interface ConflictHintPropsInterface {
  readonly error: ApiErrorInterface;
}

// AUTH_EMAIL_LINKED_TO_OTHER_ACCOUNT carries meta.providers — tell the user
// how that other account signs in instead of a dead-end message.
export function ConflictHint({ error }: ConflictHintPropsInterface): ReactElement {
  const providers: string[] = Array.isArray(error.meta?.providers)
    ? (error.meta.providers as string[])
    : [];

  return (
    <div className="rounded-lg border border-danger/40 p-3 text-sm">
      <p className="text-danger">{error.details}</p>
      {providers.length > 0 ? (
        <p className="mt-1 text-content-muted">
          That account signs in with: {providers.join(', ')}
        </p>
      ) : null}
    </div>
  );
}
