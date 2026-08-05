import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';
// <module:payment>
import type { StatisticsRevenueByPlanRowInterface } from '@modules/statistic/interfaces/statistics-revenue-by-plan-row.interface.js';
// </module:payment>

export interface StatisticRepositoryInterface {
  findUsersByStatus(): Promise<StatisticsCountRowInterface[]>;
  findAuthMethodDistribution(): Promise<StatisticsCountRowInterface[]>;
  countActiveSessions(): Promise<number>;
  findRegistrationsByDay(days: number): Promise<StatisticsDayPointInterface[]>;
  findNewDevicesByDay(days: number): Promise<StatisticsDayPointInterface[]>;
  // <module:payment>
  findRevenueByDay(days: number): Promise<StatisticsDayPointInterface[]>;
  findMrrCents(): Promise<number>;
  findRevenueByPlan(days: number): Promise<StatisticsRevenueByPlanRowInterface[]>;
  // </module:payment>
}
