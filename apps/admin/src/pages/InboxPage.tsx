import {
  type ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { ContactMessageDrawer } from '../components/Contact/ContactMessageDrawer';
import { ContactStatusFilter } from '../components/Contact/ContactStatusFilter';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { Table } from '../components/ui/Table';
import { useContactMessages } from '../hooks/contact/useContactMessages';
import type { TableColumnInterface } from '../interfaces/table-column.interface';

function statusTone(status: ContactMessageStatusEnum): 'positive' | 'neutral' {
  return status === ContactMessageStatusEnum.OPEN ? 'positive' : 'neutral';
}

const COLUMNS: Array<TableColumnInterface<ContactMessageResponseInterface>> = [
  { key: 'subject', header: 'Subject', render: (row): string => row.subject },
  { key: 'from', header: 'From', render: (row): string => `${row.name} <${row.email}>` },
  {
    key: 'status',
    header: 'Status',
    render: (row): ReactElement => <Badge label={row.status} tone={statusTone(row.status)} />,
  },
];

export function InboxPage(): ReactElement {
  const [status, setStatus] = useState<ContactMessageStatusEnum | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { messages, hasMore, isLoading, error, loadMore, reload } = useContactMessages(status);
  const selectedMessage: ContactMessageResponseInterface | null =
    messages.find((message): boolean => message.id === selectedId) ?? null;

  if (error && messages.length === 0) return <ErrorMessage error={error} onRetry={reload} />;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <ContactStatusFilter status={status} onChange={setStatus} />
      <Table
        columns={COLUMNS}
        rows={messages}
        rowKey={(row): string => row.id}
        isLoading={isLoading}
        emptyMessage="No messages"
        onRowClick={(row): void => setSelectedId(row.id)}
      />
      {hasMore ? (
        <div>
          <Button variant="ghost" onClick={(): void => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
      <ContactMessageDrawer
        message={selectedMessage}
        onClose={(): void => setSelectedId(null)}
        onStatusChanged={(): void => void reload()}
      />
    </div>
  );
}
