import type { UpdateProfileRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto implements UpdateProfileRequestInterface {
  @ApiProperty({ type: String, example: 'Igor', minLength: 1, maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  readonly displayName: string;
}
