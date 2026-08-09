import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsRevenueByPlanRowInterface } from '@modules/statistic/interfaces/statistics-revenue-by-plan-row.interface.js';
import type { StatisticsTotalsInterface } from '@modules/statistic/interfaces/statistics-totals.interface.js';

export interface StatisticsOverviewInterface {
  readonly totals: StatisticsTotalsInterface;
  readonly usersByStatus: StatisticsCountRowInterface[];
  readonly authMethodDistribution: StatisticsCountRowInterface[];
  // Empty when the payment module is absent — same rule as `totals.revenueCents`.
  readonly revenueByPlan: StatisticsRevenueByPlanRowInterface[];
}
