import type { ReactElement } from 'react';

export function Loader(): ReactElement {
  return (
    <output aria-label="Loading" className="flex justify-center p-8">
      <span className="size-6 animate-spin rounded-full border-2 border-edge border-t-accent" />
    </output>
  );
}
