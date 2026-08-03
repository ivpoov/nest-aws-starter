export interface StatisticsTotalsInterface {
  readonly users: number;
  readonly activeSessions: number;
  readonly onlineNow: number;
  readonly newToday: number;
  // Stubbed until v0.4 wires real revenue KPIs — the contract anticipates them.
  readonly revenue: number | null;
}
