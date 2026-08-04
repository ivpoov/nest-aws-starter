import type { StatisticsTotalsInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StatisticsTotalsResponseDto implements StatisticsTotalsInterface {
  @ApiProperty({ type: Number, example: 128 })
  @Expose()
  readonly users: number;

  @ApiProperty({ type: Number, example: 42 })
  @Expose()
  readonly activeSessions: number;

  @ApiProperty({ type: Number, example: 7 })
  @Expose()
  readonly onlineNow: number;

  @ApiProperty({ type: Number, example: 3 })
  @Expose()
  readonly newToday: number;

  @ApiProperty({ type: Number, nullable: true, example: 12_500 })
  @Expose()
  readonly revenue: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 4_900 })
  @Expose()
  readonly mrrCents: number | null;
}
