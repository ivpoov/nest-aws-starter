import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNotificationSocketContext } from '../../contexts/NotificationSocketContext';
import { NotificationDropdown } from './NotificationDropdown';

const MAX_DISPLAYED_COUNT = 99;

export function NotificationBell(): ReactElement {
  const { unreadCount } = useNotificationSocketContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  function toggleOpen(): void {
    setIsOpen((current: boolean) => !current);
  }

  function close(): void {
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface"
      >
        Notifications
        {unreadCount > 0 ? (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-accent-content">
            {unreadCount > MAX_DISPLAYED_COUNT ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={close}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 z-20 mt-2 w-80">
            <NotificationDropdown onItemOpened={close} />
          </div>
        </>
      ) : null}
    </div>
  );
}
