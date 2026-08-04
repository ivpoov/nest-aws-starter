import { PlanResponseDto } from '@modules/payment/dtos/responses/plan-response.dto.js';
import type { AdminPlanListResponseInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class PlanListResponseDto implements AdminPlanListResponseInterface {
  @ApiProperty({ type: [PlanResponseDto] })
  @Expose()
  @Type(() => PlanResponseDto)
  readonly items: PlanResponseDto[];

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  readonly nextCursor: string | null;
}
