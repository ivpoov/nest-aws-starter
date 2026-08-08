import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useNotificationSocketContext } from '../../contexts/NotificationSocketContext';
import { useNotificationList } from '../../hooks/notifications/useNotificationList';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ErrorMessage } from '../ui/ErrorMessage';
import { Loader } from '../ui/Loader';
import { NotificationListItem } from './NotificationListItem';

interface NotificationDropdownPropsInterface {
  readonly onItemOpened: () => void;
}

export function NotificationDropdown({
  onItemOpened,
}: NotificationDropdownPropsInterface): ReactElement {
  const { isConnected } = useNotificationSocketContext();
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore, markRead, markAllRead } =
    useNotificationList();
  const hasUnread: boolean = items.some(
    (item: NotificationResponseInterface): boolean => !item.readAt,
  );

  return (
    <div className="rounded-xl border border-edge bg-surface-raised p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notifications</h2>
        {hasUnread ? (
          <button
            type="button"
            onClick={(): void => void markAllRead()}
            className="text-xs text-accent hover:underline"
          >
            Mark all read
          </button>
        ) : null}
      </div>
      {!isConnected ? (
        <p
          role="status"
          className="mb-3 rounded-md border border-edge bg-surface px-2 py-1.5 text-xs text-content-muted"
        >
          Live updates are currently unavailable — the badge refreshes periodically and this list
          refreshes when reopened.
        </p>
      ) : null}
      {isLoading ? <Loader /> : null}
      {!isLoading && error ? <ErrorMessage error={error} /> : null}
      {!isLoading && items.length === 0 ? <EmptyState message="No notifications yet" /> : null}
      {!isLoading && items.length > 0 ? (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {items.map((item: NotificationResponseInterface) => (
            <NotificationListItem
              key={item.id}
              notification={item}
              onRead={markRead}
              onOpened={onItemOpened}
            />
          ))}
        </ul>
      ) : null}
      {hasMore ? (
        <div className="mt-3">
          <Button variant="ghost" isDisabled={isLoadingMore} onClick={(): void => void loadMore()}>
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
