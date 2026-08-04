import type { StatisticsSeriesPointInterface } from '@modules/statistic/interfaces/statistics-series-point.interface.js';
import type { StatisticsMetricEnum } from '@nest-aws-starter/shared';

export interface StatisticsSeriesInterface {
  readonly metric: StatisticsMetricEnum;
  readonly days: number;
  readonly points: StatisticsSeriesPointInterface[];
}
