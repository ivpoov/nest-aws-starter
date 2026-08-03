import { StatisticsCountBreakdownResponseDto } from '@modules/statistic/dtos/responses/statistics-count-breakdown-response.dto.js';
import { StatisticsTotalsResponseDto } from '@modules/statistic/dtos/responses/statistics-totals-response.dto.js';
import type { StatisticsOverviewResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class StatisticsOverviewResponseDto implements StatisticsOverviewResponseInterface {
  @ApiProperty({ type: StatisticsTotalsResponseDto })
  @Expose()
  @Type(() => StatisticsTotalsResponseDto)
  readonly totals: StatisticsTotalsResponseDto;

  @ApiProperty({ type: [StatisticsCountBreakdownResponseDto] })
  @Expose()
  @Type(() => StatisticsCountBreakdownResponseDto)
  readonly usersByStatus: StatisticsCountBreakdownResponseDto[];

  @ApiProperty({ type: [StatisticsCountBreakdownResponseDto] })
  @Expose()
  @Type(() => StatisticsCountBreakdownResponseDto)
  readonly authMethodDistribution: StatisticsCountBreakdownResponseDto[];
}
