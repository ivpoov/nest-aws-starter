import type { StatisticsCountBreakdownInterface } from './statistics-count-breakdown.interface.js';
import type { StatisticsTotalsInterface } from './statistics-totals.interface.js';

export interface StatisticsOverviewResponseInterface {
  readonly totals: StatisticsTotalsInterface;
  readonly usersByStatus: StatisticsCountBreakdownInterface[];
  readonly authMethodDistribution: StatisticsCountBreakdownInterface[];
}
