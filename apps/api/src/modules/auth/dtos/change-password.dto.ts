import type { ChangePasswordRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequestInterface {
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(128)
  readonly currentPassword: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password: string;
}
