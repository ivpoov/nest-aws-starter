// The visibility scope for a caller's notification feed: their own
// USER-audience rows, plus every ADMIN-audience row when the caller is an
// admin (one shared cohort table, merged in the query rather than joined —
// see NotificationPrismaRepository).
export interface NotificationScopeFiltersInterface {
  readonly userId: string;
  readonly includeAdmin: boolean;
}
