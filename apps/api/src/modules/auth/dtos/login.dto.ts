import type { LoginRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class LoginDto implements LoginRequestInterface {
  @ApiProperty({ type: String, example: 'igor@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  readonly email: string;

  @ApiProperty({ type: String, example: 'correct-horse-battery' })
  @IsString()
  @MaxLength(128)
  readonly password: string;
}
