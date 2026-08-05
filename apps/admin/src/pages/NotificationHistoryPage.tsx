import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { NotificationHistoryFilterBar } from '../components/Notifications/NotificationHistoryFilterBar';
import { NotificationHistoryTable } from '../components/Notifications/NotificationHistoryTable';
import { Button } from '../components/ui/Button';
import { useNotificationHistoryFilters } from '../hooks/notifications/useNotificationHistoryFilters';
import { useNotificationList } from '../hooks/notifications/useNotificationList';
import { resolveNotificationLink } from '../utils/resolveNotificationLink';

export function NotificationHistoryPage(): ReactElement {
  const navigate = useNavigate();
  const { filters, toggleType, clearType, toggleAudience, clearAudience } =
    useNotificationHistoryFilters();
  const { items, isLoading, hasMore, error, loadMore, markRead, markAllRead } =
    useNotificationList(filters);
  const hasUnread: boolean = items.some(
    (item: NotificationResponseInterface): boolean => !item.readAt,
  );

  function handleRowClick(notification: NotificationResponseInterface): void {
    if (!notification.readAt) void markRead(notification.id);

    const link: string | null = resolveNotificationLink(notification);

    if (link) void navigate(link);
  }

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Notifications</h1>
        {hasUnread ? (
          <Button variant="ghost" onClick={(): void => void markAllRead()}>
            Mark all read
          </Button>
        ) : null}
      </div>
      <NotificationHistoryFilterBar
        filters={filters}
        onToggleType={toggleType}
        onClearType={clearType}
        onToggleAudience={toggleAudience}
        onClearAudience={clearAudience}
      />
      <NotificationHistoryTable
        notifications={items}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onRowClick={handleRowClick}
      />
    </div>
  );
}
