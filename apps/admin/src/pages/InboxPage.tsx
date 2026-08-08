import {
  type ContactMessageResponseInterface,
  ContactMessageStatusEnum,
} from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
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
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link from a CONTACT_MESSAGE notification (see
  // resolveNotificationLink.ts). The API exposes no fetch-by-id endpoint, so
  // the drawer can only open once the id shows up in a loaded page; when it
  // does not, `isDeepLinkUnresolved` below turns what used to be a silent
  // no-op into an explicit notice with a way forward.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { messages, hasMore, isLoading, error, loadMore, reload } = useContactMessages(status);
  const selectedMessage: ContactMessageResponseInterface | null =
    messages.find((message): boolean => message.id === selectedId) ?? null;
  // Only once a fetch has settled — otherwise the notice flashes on every
  // deep link while the first page is still in flight. Stays visible while
  // the admin widens the filter or pages further back, and disappears by
  // itself the moment a loaded page contains the message.
  const isDeepLinkUnresolved: boolean = selectedId !== null && !selectedMessage && !isLoading;

  // Syncs from the URL on every change, not just first mount — an admin
  // already on /inbox who clicks a second CONTACT_MESSAGE notification
  // (bell dropdown or history page) gets a new `?messageId=` on the same
  // mounted page, which a mount-only initializer would miss. Only acts
  // when the param is present: an unrelated re-render (status filter,
  // page load) with no messageId must not force the drawer closed —
  // closing already goes through closeDrawer, which clears both.
  useEffect(() => {
    const messageId: string | null = searchParams.get('messageId');

    if (messageId) setSelectedId(messageId);
  }, [searchParams]);

  function closeDrawer(): void {
    setSelectedId(null);
    setSearchParams(
      (current: URLSearchParams): URLSearchParams => {
        const next: URLSearchParams = new URLSearchParams(current);

        next.delete('messageId');

        return next;
      },
      { replace: true },
    );
  }

  if (error && messages.length === 0) return <ErrorMessage error={error} onRetry={reload} />;

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <ContactStatusFilter status={status} onChange={setStatus} />
      {isDeepLinkUnresolved ? (
        <div
          role="status"
          className="flex flex-col items-start gap-2 rounded-lg border border-edge bg-surface px-4 py-3 text-sm"
        >
          <p className="text-content-muted">
            That message isn’t in the messages loaded here — it may be older than the loaded pages,
            or excluded by the current status filter.
          </p>
          <div className="flex gap-2">
            {status !== null ? (
              <Button variant="ghost" onClick={(): void => setStatus(null)}>
                Show all statuses
              </Button>
            ) : null}
            {hasMore ? (
              <Button variant="ghost" onClick={(): void => void loadMore()}>
                Load older messages
              </Button>
            ) : null}
            <Button variant="ghost" onClick={closeDrawer}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
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
        onClose={closeDrawer}
        onStatusChanged={(): void => void reload()}
      />
    </div>
  );
}
