import { StatisticsSeriesPointResponseDto } from '@modules/statistic/dtos/responses/statistics-series-point-response.dto.js';
import {
  StatisticsMetricEnum,
  type StatisticsSeriesResponseInterface,
} from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class StatisticsSeriesResponseDto implements StatisticsSeriesResponseInterface {
  @ApiProperty({ enum: StatisticsMetricEnum, example: StatisticsMetricEnum.REGISTRATIONS })
  @Expose()
  readonly metric: StatisticsMetricEnum;

  @ApiProperty({ type: Number, example: 30 })
  @Expose()
  readonly days: number;

  @ApiProperty({ type: [StatisticsSeriesPointResponseDto] })
  @Expose()
  @Type(() => StatisticsSeriesPointResponseDto)
  readonly points: StatisticsSeriesPointResponseDto[];
}
