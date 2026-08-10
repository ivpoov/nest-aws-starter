export interface StatisticsRevenueByPlanInterface {
  // Null on the single "unattributed" row: revenue from transactions that
  // carry no subscription and so belong to no plan. It is included so the
  // breakdown sums to StatisticsTotalsInterface.revenueCents rather than
  // silently under-reporting against the total shown beside it.
  readonly planId: string | null;
  readonly planName: string | null;
  // Succeeded minus refunded, trailing 30 days, single reporting currency —
  // same window/currency assumption as StatisticsTotalsInterface.revenueCents.
  readonly amountCents: number;
}
