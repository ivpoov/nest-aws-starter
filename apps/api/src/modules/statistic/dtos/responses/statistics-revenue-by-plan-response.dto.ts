import type { StatisticsRevenueByPlanInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StatisticsRevenueByPlanResponseDto implements StatisticsRevenueByPlanInterface {
  // Null on the unattributed row — revenue with no subscription behind it.
  @ApiProperty({ type: String, nullable: true, example: '6d3d19c1-9e6a-4a5b-8f21-0f1d2c3b4a5e' })
  @Expose()
  readonly planId: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Pro' })
  @Expose()
  readonly planName: string | null;

  @ApiProperty({ type: Number, example: 4_900 })
  @Expose()
  readonly amountCents: number;
}
