import type { CreateApiKeyRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto implements CreateApiKeyRequestInterface {
  @ApiProperty({ type: String, example: 'CI deploy bot', maxLength: 120 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  readonly name: string;
}
