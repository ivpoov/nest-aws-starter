import type { StatisticsSeriesPointInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StatisticsSeriesPointResponseDto implements StatisticsSeriesPointInterface {
  @ApiProperty({ type: String, example: '2026-08-01' })
  @Expose()
  readonly date: string;

  @ApiProperty({ type: Number, example: 5 })
  @Expose()
  readonly value: number;
}
