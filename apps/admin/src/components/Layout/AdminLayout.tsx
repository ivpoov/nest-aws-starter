import type { ReactElement } from 'react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useLogout } from '../../hooks/auth/useLogout';
import { NotificationBell } from '../Notifications/NotificationBell'; // <module:notification>
import { ThemeToggle } from '../ui/ThemeToggle';

const NAV_ITEMS: ReadonlyArray<{ readonly to: string; readonly label: string }> = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/users', label: 'Users' },
  { to: '/plans', label: 'Plans' }, // <module:payment>
  { to: '/transactions', label: 'Transactions' }, // <module:payment>
  { to: '/activities', label: 'Activity' },
  { to: '/inbox', label: 'Inbox' },
  { to: '/notifications', label: 'Notifications' }, // <module:notification>
];

export function AdminLayout(): ReactElement {
  const { logout } = useLogout();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  function handleNavClick(): void {
    setIsDrawerOpen(false);
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`${isDrawerOpen ? 'block' : 'hidden'} fixed inset-y-0 left-0 z-10 w-56 border-r border-edge bg-surface-raised p-4 md:static md:block`}
      >
        <p className="mb-6 text-sm font-semibold">Starter Admin</p>
        <nav className="flex flex-col gap-2 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={({ isActive }): string =>
                isActive
                  ? 'rounded-lg bg-surface px-3 py-2 font-semibold text-accent'
                  : 'rounded-lg px-3 py-2 text-content-muted hover:text-content'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 grow flex-col">
        <header className="flex items-center justify-between border-b border-edge px-6 py-3">
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={(): void => setIsDrawerOpen(!isDrawerOpen)}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm md:hidden"
          >
            Menu
          </button>
          <div className="ml-auto flex items-center gap-3">
            {/* <module:notification> */}
            <NotificationBell />
            {/* </module:notification> */}
            <ThemeToggle />
            <button
              type="button"
              onClick={(): void => void logout()}
              className="text-sm text-content-muted hover:text-content"
            >
              Log out
            </button>
          </div>
        </header>
        <main className="grow px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
