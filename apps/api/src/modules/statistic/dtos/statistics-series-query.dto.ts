import { StatisticsMetricEnum } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class StatisticsSeriesQueryDto {
  @ApiProperty({ enum: StatisticsMetricEnum, example: StatisticsMetricEnum.REGISTRATIONS })
  @IsEnum(StatisticsMetricEnum)
  readonly metric: StatisticsMetricEnum;

  @ApiPropertyOptional({ type: Number, example: 30, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  @Type(() => Number)
  readonly days: number = 30;
}
