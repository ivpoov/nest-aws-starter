import { PublicPlanResponseDto } from '@modules/payment/dtos/responses/public-plan-response.dto.js';
import type { PublicPlansResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class PublicPlansResponseDto implements PublicPlansResponseInterface {
  @ApiProperty({ type: [PublicPlanResponseDto] })
  @Expose()
  @Type(() => PublicPlanResponseDto)
  readonly items: PublicPlanResponseDto[];
}
