import type { StatisticsRevenueByPlanInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StatisticsRevenueByPlanResponseDto implements StatisticsRevenueByPlanInterface {
  @ApiProperty({ type: String, example: '6d3d19c1-9e6a-4a5b-8f21-0f1d2c3b4a5e' })
  @Expose()
  readonly planId: string;

  @ApiProperty({ type: String, example: 'Pro' })
  @Expose()
  readonly planName: string;

  @ApiProperty({ type: Number, example: 4_900 })
  @Expose()
  readonly amountCents: number;
}
