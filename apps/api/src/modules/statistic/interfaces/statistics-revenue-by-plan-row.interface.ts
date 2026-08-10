// Domain shape for a single plan's revenue-by-plan breakdown row. Both plan
// fields are null on the "unattributed" row — revenue from transactions that
// carry no subscription, and therefore no plan (see revenueByPlan.sql).
export interface StatisticsRevenueByPlanRowInterface {
  readonly planId: string | null;
  readonly planName: string | null;
  readonly amountCents: number;
}
