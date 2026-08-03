import type { ForgotPasswordRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto implements ForgotPasswordRequestInterface {
  @ApiProperty({ type: String, example: 'igor@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  readonly email: string;
}
