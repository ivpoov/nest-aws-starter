import type { ReactElement } from 'react';

interface StatTilePropsInterface {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}

export function StatTile({ label, value, hint }: StatTilePropsInterface): ReactElement {
  return (
    <div className="rounded-lg border border-edge p-4">
      <p className="text-sm text-content-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-content-muted">{hint}</p> : null}
    </div>
  );
}
