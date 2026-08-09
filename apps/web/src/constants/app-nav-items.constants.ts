import type { AppNavItemInterface } from '../interfaces/app-nav-item.interface';

// The header nav, in order — and the single list a module removal edits to
// drop its section from the user app. Order is load-bearing: the first entry
// is the app's home (see app-home-route.constants.ts), so fencing an optional
// module's entry out also moves the post-login and catch-all redirects onto
// the next surviving page instead of leaving them pointed at a deleted route.
export const APP_NAV_ITEMS: readonly AppNavItemInterface[] = [
  { to: '/notes', label: 'Notes' }, // <module:note>
  { to: '/profile', label: 'Profile' },
  { to: '/settings/methods', label: 'Sign-in methods' },
  { to: '/settings/sessions', label: 'Sessions' },
  { to: '/settings/billing', label: 'Billing' }, // <module:payment>
  { to: '/settings/notifications', label: 'Notifications' }, // <module:notification>
];
