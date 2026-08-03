import type { ReactElement } from 'react';

interface EmptyStatePropsInterface {
  readonly message: string;
}

export function EmptyState({ message }: EmptyStatePropsInterface): ReactElement {
  return <p className="p-8 text-center text-sm text-content-muted">{message}</p>;
}
