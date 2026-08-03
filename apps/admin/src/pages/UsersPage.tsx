import { type AdminUserResponseInterface, UserStatusEnum } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { UserDetailDrawer } from '../components/Users/UserDetailDrawer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Input } from '../components/ui/Input';
import { Table } from '../components/ui/Table';
import { useAdminUsers } from '../hooks/users/useAdminUsers';
import type { TableColumnInterface } from '../interfaces/table-column.interface';

const COLUMNS: Array<TableColumnInterface<AdminUserResponseInterface>> = [
  { key: 'name', header: 'Name', render: (row): string => row.displayName },
  { key: 'email', header: 'Email', render: (row): string => row.email ?? '—' },
  {
    key: 'methods',
    header: 'Methods',
    render: (row): ReactElement => (
      <span className="flex gap-1">
        {row.methodTypes.map((type) => (
          <Badge key={type} label={type} />
        ))}
      </span>
    ),
  },
  { key: 'role', header: 'Role', render: (row): ReactElement => <Badge label={row.role} /> },
  {
    key: 'status',
    header: 'Status',
    render: (row): ReactElement => (
      <Badge
        label={row.status}
        tone={row.status === UserStatusEnum.BLOCKED ? 'negative' : 'neutral'}
      />
    ),
  },
];

export function UsersPage(): ReactElement {
  const [search, setSearch] = useState<string>('');
  const [submittedSearch, setSubmittedSearch] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { users, hasMore, isLoading, error, loadMore, reload } = useAdminUsers(submittedSearch);

  if (error && users.length === 0) return <ErrorMessage error={error} />;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <form
        className="flex items-end gap-3"
        onSubmit={(event): void => {
          event.preventDefault();
          setSubmittedSearch(search);
        }}
      >
        <div className="max-w-xs grow">
          <Input label="Search by name or email" value={search} onChange={setSearch} />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <Table
        columns={COLUMNS}
        rows={users}
        rowKey={(row): string => row.id}
        isLoading={isLoading}
        emptyMessage="No users match"
        onRowClick={(row): void => setSelectedUserId(row.id)}
      />
      {hasMore ? (
        <div>
          <Button variant="ghost" onClick={(): void => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
      <UserDetailDrawer
        userId={selectedUserId}
        onClose={(): void => setSelectedUserId(null)}
        onUserChanged={(): void => void reload()}
      />
    </div>
  );
}
