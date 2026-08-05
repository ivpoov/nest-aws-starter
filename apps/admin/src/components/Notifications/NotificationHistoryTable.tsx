import type { ApiErrorInterface, NotificationResponseInterface } from '@nest-aws-starter/shared';
import { NotificationAudienceEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import type { TableColumnInterface } from '../../interfaces/table-column.interface';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Table } from '../ui/Table';

interface NotificationHistoryTablePropsInterface {
  readonly notifications: NotificationResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly hasMore: boolean;
  readonly onLoadMore: () => Promise<void>;
  readonly onRowClick: (notification: NotificationResponseInterface) => void;
}

function audienceTone(audience: NotificationAudienceEnum): 'neutral' | 'positive' {
  return audience === NotificationAudienceEnum.ADMIN ? 'positive' : 'neutral';
}

const COLUMNS: Array<TableColumnInterface<NotificationResponseInterface>> = [
  {
    key: 'notification',
    header: 'Notification',
    render: (row): ReactElement => (
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{row.title}</span>
        <span className="text-content-muted">{row.body}</span>
      </span>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    render: (row): ReactElement => <Badge label={row.type} />,
  },
  {
    key: 'audience',
    header: 'Audience',
    render: (row): ReactElement => <Badge label={row.audience} tone={audienceTone(row.audience)} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row): ReactElement => (
      <Badge label={row.readAt ? 'Read' : 'Unread'} tone={row.readAt ? 'neutral' : 'positive'} />
    ),
  },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row): string => new Date(row.createdAt).toLocaleString(),
  },
];

export function NotificationHistoryTable({
  notifications,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  onRowClick,
}: NotificationHistoryTablePropsInterface): ReactElement {
  function handleLoadMoreClick(): void {
    void onLoadMore();
  }

  if (error && notifications.length === 0) return <ErrorMessage error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <Table
        columns={COLUMNS}
        rows={notifications}
        rowKey={(row): string => row.id}
        isLoading={isLoading}
        emptyMessage="No notifications match these filters"
        onRowClick={onRowClick}
      />
      {error && notifications.length > 0 ? <p className="text-danger">{error.details}</p> : null}
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
