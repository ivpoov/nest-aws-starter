import type { NotificationResponseInterface } from '@nest-aws-starter/shared';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { resolveNotificationLink } from '../../utils/resolveNotificationLink';

interface NotificationListItemPropsInterface {
  readonly notification: NotificationResponseInterface;
  readonly onRead: (id: string) => void;
  readonly onOpened: () => void;
}

export function NotificationListItem({
  notification,
  onRead,
  onOpened,
}: NotificationListItemPropsInterface): ReactElement {
  const navigate = useNavigate();
  const isUnread: boolean = !notification.readAt;

  function handleClick(): void {
    if (isUnread) onRead(notification.id);

    const link: string | null = resolveNotificationLink(notification);

    onOpened();

    if (link) void navigate(link);
  }

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-sm ${
          isUnread ? 'border-accent/40 bg-accent/5' : 'border-edge'
        }`}
      >
        <span className="flex w-full items-center justify-between gap-2 font-medium">
          {notification.title}
          {isUnread ? <span aria-hidden="true" className="size-2 rounded-full bg-accent" /> : null}
        </span>
        <span className="text-content-muted">{notification.body}</span>
        <span className="text-xs text-content-muted">
          {new Date(notification.createdAt).toLocaleString()}
        </span>
      </button>
    </li>
  );
}
