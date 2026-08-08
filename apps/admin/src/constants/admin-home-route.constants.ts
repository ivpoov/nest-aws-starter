import { ADMIN_NAV_ITEMS } from './admin-nav-items.constants';

// Where a fresh login and the catch-all route land. Derived from the nav
// rather than hardcoded to '/dashboard': that page belongs to the optional
// `statistic` module, and a hardcoded redirect would survive its removal as a
// navigation to a route that no longer exists — a runtime break no type-check
// or unit test would catch. '/users' is the fallback for the (impossible in
// practice) case of an empty nav: it is a core, non-removable page.
export const ADMIN_HOME_ROUTE: string = ADMIN_NAV_ITEMS[0]?.to ?? '/users';
