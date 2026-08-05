import type { CreateCheckoutRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCheckoutDto implements CreateCheckoutRequestInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @IsUUID('all')
  readonly planId: string;
}
