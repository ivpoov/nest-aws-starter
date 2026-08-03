import type { AuthMethodResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';

interface MethodListPropsInterface {
  readonly methods: AuthMethodResponseInterface[];
  readonly onUnlink: (type: string) => void;
}

export function MethodList({ methods, onUnlink }: MethodListPropsInterface): ReactElement {
  if (methods.length === 0) return <EmptyState message="No sign-in methods" />;

  return (
    <ul className="flex flex-col gap-3">
      {methods.map((method: AuthMethodResponseInterface) => (
        <li
          key={method.type}
          className="flex items-center justify-between rounded-lg border border-edge p-3 text-sm"
        >
          <div className="flex flex-col">
            <span className="font-medium">{method.type}</span>
            <span className="text-content-muted">
              {method.email ?? 'No email'}
              {method.email && !method.isEmailVerified ? ' (unverified)' : ''}
            </span>
          </div>
          <Button variant="ghost" onClick={(): void => onUnlink(method.type)}>
            Unlink
          </Button>
        </li>
      ))}
    </ul>
  );
}
