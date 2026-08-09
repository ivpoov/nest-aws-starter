export interface StatisticsTotalsInterface {
  readonly users: number;
  readonly activeSessions: number;
  readonly onlineNow: number;
  readonly newToday: number;
  // Null when the payment module is absent (subtraction-removable) — see
  // StatisticService.composeOverview.
  readonly revenueCents: number | null;
  readonly mrrCents: number | null;
}
