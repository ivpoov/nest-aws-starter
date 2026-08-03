import type { RegisterRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto implements RegisterRequestInterface {
  @ApiProperty({ type: String, example: 'Igor', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  readonly displayName: string;

  @ApiProperty({ type: String, example: 'igor@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  readonly email: string;

  @ApiProperty({ type: String, example: 'correct-horse-battery', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password: string;
}
