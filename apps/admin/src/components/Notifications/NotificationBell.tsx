import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNotificationSocketContext } from '../../contexts/NotificationSocketContext';
import { NotificationDropdown } from './NotificationDropdown';

const MAX_DISPLAYED_COUNT = 99;
const PANEL_ID = 'notification-dropdown-panel';

function badgeLabel(unreadCount: number): string {
  return unreadCount > MAX_DISPLAYED_COUNT ? '99+' : String(unreadCount);
}

function bellLabel(unreadCount: number): string {
  return unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';
}

function liveLabel(unreadCount: number): string {
  return unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications';
}

// `aria-label` wins over a button's own text in the accessible-name
// computation, so the badge number has to be spelled into the label itself —
// otherwise the bell announces a bare "Notifications" whether the count is 0
// or 99. The badge span is then aria-hidden so the figure is not announced
// twice, and a separate always-mounted live region is what announces a
// *change*: a region inserted together with its first content is announced
// unreliably, so it stays in the tree at zero unread too.
export function NotificationBell(): ReactElement {
  const { unreadCount } = useNotificationSocketContext();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes, mirroring the Modal primitive (document-level listener,
  // only while open). Focus goes back to the bell so the tab order resumes
  // where the user left it instead of collapsing to the top of the page.
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;

      setIsOpen(false);
      bellRef.current?.focus();
    }

    document.addEventListener('keydown', handleKeyDown);

    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Moves focus into the panel on open so the next Tab walks the
  // notifications rather than whatever follows the bell in the header.
  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  function toggleOpen(): void {
    setIsOpen((current: boolean) => !current);
  }

  function close(): void {
    setIsOpen(false);
    bellRef.current?.focus();
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={toggleOpen}
        aria-label={bellLabel(unreadCount)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={isOpen ? PANEL_ID : undefined}
        className="relative rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface"
      >
        Notifications
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-accent-content"
          >
            {badgeLabel(unreadCount)}
          </span>
        ) : null}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {liveLabel(unreadCount)}
      </span>
      {isOpen ? (
        <>
          {/* Pointer-only outside-click catcher: it covers the viewport, so
              leaving it in the tab order puts an invisible full-screen
              control between the bell and the first notification. Escape is
              the keyboard equivalent. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={close}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            ref={panelRef}
            id={PANEL_ID}
            role="dialog"
            aria-label="Notifications"
            tabIndex={-1}
            className="absolute right-0 z-20 mt-2 w-80"
          >
            <NotificationDropdown onItemOpened={close} />
          </div>
        </>
      ) : null}
    </div>
  );
}
