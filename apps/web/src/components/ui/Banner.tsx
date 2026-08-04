import type { ReactElement, ReactNode } from 'react';

interface BannerPropsInterface {
  readonly children: ReactNode;
}

export function Banner({ children }: BannerPropsInterface): ReactElement {
  return (
    <div className="border-b border-danger/40 bg-danger/10 px-6 py-2 text-center text-sm text-danger">
      {children}
    </div>
  );
}
