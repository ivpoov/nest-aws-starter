import type { ReactElement } from 'react';
import type { TableColumnInterface } from '../../interfaces/table-column.interface';
import { EmptyState } from './EmptyState';
import { Loader } from './Loader';

interface TablePropsInterface<T> {
  readonly columns: Array<TableColumnInterface<T>>;
  readonly rows: T[];
  readonly rowKey: (row: T) => string;
  readonly isLoading: boolean;
  readonly emptyMessage: string;
  readonly onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage,
  onRowClick,
}: TablePropsInterface<T>): ReactElement {
  if (isLoading && rows.length === 0) return <Loader />;
  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto rounded-xl border border-edge">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-edge text-content-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: T) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? (): void => onRowClick(row) : undefined}
              className={
                onRowClick
                  ? 'cursor-pointer border-b border-edge last:border-0 hover:bg-surface'
                  : 'border-b border-edge last:border-0'
              }
            >
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
