import type { ReactElement, ReactNode } from 'react';

interface CardPropsInterface {
  readonly title?: string;
  readonly children: ReactNode;
}

export function Card({ title, children }: CardPropsInterface): ReactElement {
  return (
    <section className="rounded-xl border border-edge bg-surface-raised p-6 shadow-sm">
      {title ? <h2 className="mb-4 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}
