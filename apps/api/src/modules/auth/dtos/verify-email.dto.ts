import type { VerifyEmailRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class VerifyEmailDto implements VerifyEmailRequestInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @IsUUID('all')
  readonly userId: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  readonly token: string;
}
