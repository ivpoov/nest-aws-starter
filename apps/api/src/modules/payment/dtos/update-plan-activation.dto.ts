import type { UpdatePlanActivationRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdatePlanActivationDto implements UpdatePlanActivationRequestInterface {
  @ApiProperty({ type: Boolean, example: true })
  @IsBoolean()
  readonly isActive: boolean;
}
