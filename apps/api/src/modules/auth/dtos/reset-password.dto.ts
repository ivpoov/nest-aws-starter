import type { ResetPasswordRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto implements ResetPasswordRequestInterface {
  @ApiProperty({ type: String, example: '01890a5d-ac96-774b-bcce-b302099a8057' })
  @IsUUID('all')
  readonly userId: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  readonly token: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password: string;
}
