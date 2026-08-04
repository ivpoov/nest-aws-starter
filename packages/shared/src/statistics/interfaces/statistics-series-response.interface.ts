import type { StatisticsMetricEnum } from '../enums/statistics-metric.enum.js';
import type { StatisticsSeriesPointInterface } from './statistics-series-point.interface.js';

export interface StatisticsSeriesResponseInterface {
  readonly metric: StatisticsMetricEnum;
  readonly days: number;
  readonly points: StatisticsSeriesPointInterface[];
}
