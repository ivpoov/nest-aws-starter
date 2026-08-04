import type { StatisticsCountBreakdownInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class StatisticsCountBreakdownResponseDto implements StatisticsCountBreakdownInterface {
  @ApiProperty({ type: String, example: 'ACTIVE' })
  @Expose()
  readonly key: string;

  @ApiProperty({ type: Number, example: 100 })
  @Expose()
  readonly count: number;
}
