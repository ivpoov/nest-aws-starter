import type { StatisticsCountBreakdownInterface } from './statistics-count-breakdown.interface.js';
import type { StatisticsRevenueByPlanInterface } from './statistics-revenue-by-plan.interface.js';
import type { StatisticsTotalsInterface } from './statistics-totals.interface.js';

export interface StatisticsOverviewResponseInterface {
  readonly totals: StatisticsTotalsInterface;
  readonly usersByStatus: StatisticsCountBreakdownInterface[];
  readonly authMethodDistribution: StatisticsCountBreakdownInterface[];
  // Empty when the payment module is absent — same degrade-gracefully rule
  // as `totals.revenue`.
  readonly revenueByPlan: StatisticsRevenueByPlanInterface[];
}
