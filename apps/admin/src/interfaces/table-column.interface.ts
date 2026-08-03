import type { ReactNode } from 'react';

export interface TableColumnInterface<T> {
  readonly key: string;
  readonly header: string;
  readonly render: (row: T) => ReactNode;
}
