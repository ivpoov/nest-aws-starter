import type {
  AdminTransactionResponseInterface,
  ApiErrorInterface,
} from '@nest-aws-starter/shared';
import { TransactionStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import type { TableColumnInterface } from '../../interfaces/table-column.interface';
import { formatMoney } from '../../utils/formatMoney';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Table } from '../ui/Table';

interface TransactionListPropsInterface {
  readonly transactions: AdminTransactionResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly hasMore: boolean;
  readonly onLoadMore: () => Promise<void>;
}

const STATUS_TONE: Record<TransactionStatusEnum, 'neutral' | 'positive' | 'negative'> = {
  [TransactionStatusEnum.SUCCEEDED]: 'positive',
  [TransactionStatusEnum.FAILED]: 'negative',
  [TransactionStatusEnum.REFUNDED]: 'neutral',
};

// Short + a title attribute for the full value on hover — mirrors the
// providerRef truncation the same way, no separate component for a
// two-line helper.
function truncate(value: string, visibleChars: number): string {
  return value.length > visibleChars ? `${value.slice(0, visibleChars)}…` : value;
}

const COLUMNS: Array<TableColumnInterface<AdminTransactionResponseInterface>> = [
  {
    key: 'createdAt',
    header: 'Date',
    render: (row): string => new Date(row.createdAt).toLocaleString(),
  },
  {
    key: 'user',
    header: 'User',
    render: (row): ReactElement => (
      <span className="font-mono text-xs" title={row.userId}>
        {truncate(row.userId, 8)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row): ReactElement => <Badge label={row.status} tone={STATUS_TONE[row.status]} />,
  },
  {
    key: 'amount',
    header: 'Amount',
    render: (row): string => formatMoney(row.amountCents, row.currency),
  },
  { key: 'provider', header: 'Provider', render: (row): string => row.provider },
  {
    key: 'providerRef',
    header: 'Reference',
    render: (row): ReactElement => (
      <span className="font-mono text-xs" title={row.providerRef}>
        {truncate(row.providerRef, 16)}
      </span>
    ),
  },
];

export function TransactionList({
  transactions,
  isLoading,
  error,
  hasMore,
  onLoadMore,
}: TransactionListPropsInterface): ReactElement {
  function handleLoadMoreClick(): void {
    void onLoadMore();
  }

  if (error && transactions.length === 0) return <ErrorMessage error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <Table
        columns={COLUMNS}
        rows={transactions}
        rowKey={(row): string => row.id}
        isLoading={isLoading}
        emptyMessage="No transactions match these filters"
      />
      {error && transactions.length > 0 ? <p className="text-danger">{error.details}</p> : null}
      {hasMore ? (
        <div>
          <Button variant="ghost" onClick={handleLoadMoreClick}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
