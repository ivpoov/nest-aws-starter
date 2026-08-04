import type { ReactElement } from 'react';

interface BadgePropsInterface {
  readonly label: string;
}

export function Badge({ label }: BadgePropsInterface): ReactElement {
  return (
    <span className="rounded-full border border-danger/40 px-2 py-0.5 text-xs text-danger">
      {label}
    </span>
  );
}
