import { APP_NAV_ITEMS } from './app-nav-items.constants';

// Where a fresh login, a fresh registration, an OAuth login callback and the
// catch-all route land. Derived from the nav rather than hardcoded to
// '/notes': that page belongs to the optional `note` demo module, and a
// hardcoded redirect would survive its removal as a navigation to a route that
// no longer exists — a runtime break no type-check or unit test would catch.
// '/profile' is the fallback for the (impossible in practice) case of an empty
// nav: it is a core, non-removable page.
export const APP_HOME_ROUTE: string = APP_NAV_ITEMS[0]?.to ?? '/profile';
