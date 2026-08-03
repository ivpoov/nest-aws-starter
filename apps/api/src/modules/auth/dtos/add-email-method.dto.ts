import type { AddEmailMethodRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class AddEmailMethodDto implements AddEmailMethodRequestInterface {
  @ApiProperty({ type: String, example: 'igor@example.com', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  readonly email: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  readonly password: string;
}
