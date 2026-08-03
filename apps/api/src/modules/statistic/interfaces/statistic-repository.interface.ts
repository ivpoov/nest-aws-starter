import type { StatisticsCountRowInterface } from '@modules/statistic/interfaces/statistics-count-row.interface.js';
import type { StatisticsDayPointInterface } from '@modules/statistic/interfaces/statistics-day-point.interface.js';

export interface StatisticRepositoryInterface {
  findUsersByStatus(): Promise<StatisticsCountRowInterface[]>;
  findAuthMethodDistribution(): Promise<StatisticsCountRowInterface[]>;
  countActiveSessions(): Promise<number>;
  findRegistrationsByDay(days: number): Promise<StatisticsDayPointInterface[]>;
  findNewDevicesByDay(days: number): Promise<StatisticsDayPointInterface[]>;
}
