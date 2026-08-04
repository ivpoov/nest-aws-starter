// Domain shape for a single plan's revenue-by-plan breakdown row.
export interface StatisticsRevenueByPlanRowInterface {
  readonly planId: string;
  readonly planName: string;
  readonly amountCents: number;
}
