import type { AdminNavItemInterface } from '../interfaces/admin-nav-item.interface';

// The sidebar, in order — and the single list a module removal edits to drop
// its section from the admin app. Order is load-bearing: the first entry is
// the app's home (see admin-home-route.constants.ts), so fencing an optional
// module's entry out also moves the post-login and catch-all redirects onto
// the next surviving page instead of leaving them pointed at a deleted route.
export const ADMIN_NAV_ITEMS: readonly AdminNavItemInterface[] = [
  { to: '/dashboard', label: 'Dashboard' }, // <module:statistic>
  { to: '/users', label: 'Users' },
  { to: '/plans', label: 'Plans' }, // <module:payment>
  { to: '/transactions', label: 'Transactions' }, // <module:payment>
  { to: '/activities', label: 'Activity' },
  { to: '/inbox', label: 'Inbox' }, // <module:contact-us>
  { to: '/notifications', label: 'Notifications' }, // <module:notification>
];
