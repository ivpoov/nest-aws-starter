import type { ReactElement } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useIsImpersonating } from '../../hooks/auth/useIsImpersonating';
import { useLogout } from '../../hooks/auth/useLogout';
import { Banner } from '../ui/Banner';
import { ThemeToggle } from '../ui/ThemeToggle';

const NAV_ITEMS: ReadonlyArray<{ readonly to: string; readonly label: string }> = [
  { to: '/notes', label: 'Notes' },
  { to: '/profile', label: 'Profile' },
  { to: '/settings/methods', label: 'Sign-in methods' },
  { to: '/settings/sessions', label: 'Sessions' },
  { to: '/settings/billing', label: 'Billing' },
];

export function AppLayout(): ReactElement {
  const { logout } = useLogout();
  const isImpersonating: boolean = useIsImpersonating();

  return (
    <div className="min-h-screen">
      {isImpersonating ? <Banner>Viewing as this user — session started by an admin</Banner> : null}
      <header className="flex items-center justify-between border-b border-edge px-6 py-3">
        <nav className="flex gap-4 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }): string =>
                isActive ? 'font-semibold text-accent' : 'text-content-muted hover:text-content'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="text-sm text-content-muted hover:text-content"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-edge px-6 py-4 text-center text-sm text-content-muted">
        <Link to="/contact" className="hover:text-content">
          Contact us
        </Link>
      </footer>
    </div>
  );
}
