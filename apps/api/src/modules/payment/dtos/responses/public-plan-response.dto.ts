import type { PublicPlanResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PublicPlanResponseDto implements PublicPlanResponseInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @Expose()
  readonly id: string;

  @ApiProperty({ type: String, example: 'Starter Monthly' })
  @Expose()
  readonly name: string;

  @ApiProperty({ type: String, example: 'Monthly access to the starter tier' })
  @Expose()
  readonly description: string;

  @ApiProperty({ type: Number, example: 999 })
  @Expose()
  readonly amountCents: number;

  @ApiProperty({ type: String, example: 'USD' })
  @Expose()
  readonly currency: string;

  @ApiProperty({ type: Number, example: 30 })
  @Expose()
  readonly intervalDays: number;
}
