import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsTotalsInterface } from '@modules/statistic/interfaces/statistics-totals.interface.js';

export interface StatisticsOverviewInterface {
  readonly totals: StatisticsTotalsInterface;
  readonly usersByStatus: StatisticsCountRowInterface[];
  readonly authMethodDistribution: StatisticsCountRowInterface[];
}
