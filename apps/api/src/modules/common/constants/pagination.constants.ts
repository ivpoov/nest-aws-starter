// The one page-size budget every list in this app obeys. It is the `@Max` on
// both pagination DTOs, and it is also the hard `take` on the handful of lists
// whose wire contract is a plain array with no cursor at all: those endpoints
// accept no `limit`, so without a cap here the result set is whatever the
// database happens to hold. `GET /billing/plans` is public and
// unauthenticated, which makes an unbounded row count there a denial-of-service
// vector rather than a slow page. Raising this raises every list at once — that
// is the point; there is deliberately no per-endpoint cap to drift.
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
