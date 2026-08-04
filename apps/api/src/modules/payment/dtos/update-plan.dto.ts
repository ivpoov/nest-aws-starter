import { CreatePlanDto } from '@modules/payment/dtos/create-plan.dto.js';
import type { UpdatePlanRequestInterface } from '@nest-aws-starter/shared';
import { PartialType } from '@nestjs/swagger';

export class UpdatePlanDto
  extends PartialType(CreatePlanDto)
  implements UpdatePlanRequestInterface {}
