import type { ActivityResponseInterface, ApiErrorInterface } from '@nest-aws-starter/shared';
import { ActivityTypeEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import type { TableColumnInterface } from '../../interfaces/table-column.interface';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Table } from '../ui/Table';

interface ActivityListPropsInterface {
  readonly activities: ActivityResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly hasMore: boolean;
  readonly onLoadMore: () => Promise<void>;
  readonly emptyMessage?: string;
}

function activityTone(type: ActivityTypeEnum): 'neutral' | 'positive' | 'negative' {
  if (type === ActivityTypeEnum.AUTH_LOGIN_FAILED) return 'negative';

  if (
    type === ActivityTypeEnum.AUTH_LOGIN ||
    type === ActivityTypeEnum.USER_REGISTERED ||
    type === ActivityTypeEnum.USER_OAUTH_REGISTERED
  ) {
    return 'positive';
  }

  return 'neutral';
}

const COLUMNS: Array<TableColumnInterface<ActivityResponseInterface>> = [
  {
    key: 'type',
    header: 'Type',
    render: (row): ReactElement => <Badge label={row.type} tone={activityTone(row.type)} />,
  },
  { key: 'user', header: 'User', render: (row): string => row.userId ?? 'System' },
  { key: 'ip', header: 'IP', render: (row): string => row.ip ?? '—' },
  {
    key: 'meta',
    header: 'Details',
    render: (row): string => (row.meta ? JSON.stringify(row.meta) : '—'),
  },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row): string => new Date(row.createdAt).toLocaleString(),
  },
];

export function ActivityList({
  activities,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  emptyMessage = 'No activity found',
}: ActivityListPropsInterface): ReactElement {
  function handleLoadMoreClick(): void {
    void onLoadMore();
  }

  if (error && activities.length === 0) return <ErrorMessage error={error} />;

  return (
    <div className="flex flex-col gap-4">
      <Table
        columns={COLUMNS}
        rows={activities}
        rowKey={(row): string => row.id}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
      />
      {error && activities.length > 0 ? <p className="text-danger">{error.details}</p> : null}
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
