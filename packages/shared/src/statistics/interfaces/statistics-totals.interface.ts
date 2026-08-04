export interface StatisticsTotalsInterface {
  readonly users: number;
  readonly activeSessions: number;
  readonly onlineNow: number;
  readonly newToday: number;
  // Succeeded minus refunded transaction totals for the trailing 30 days, in
  // the single reporting currency the starter assumes (see
  // STATISTIC_REPORTING_CURRENCY). Null when the payment module is absent
  // (subtraction-removable) — same shape as the v0.3 stub.
  readonly revenue: number | null;
  // Monthly recurring revenue: active subscriptions' plan amounts normalized
  // to a 30-day month. Null under the same condition as `revenue`.
  readonly mrrCents: number | null;
}
