export interface StatisticsRevenueByPlanInterface {
  readonly planId: string;
  readonly planName: string;
  // Succeeded minus refunded, trailing 30 days, single reporting currency —
  // same window/currency assumption as StatisticsTotalsInterface.revenueCents.
  readonly amountCents: number;
}
