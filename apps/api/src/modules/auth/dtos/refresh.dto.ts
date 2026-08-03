import type { RefreshRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto implements RefreshRequestInterface {
  @ApiProperty({ type: String, example: 'eyJhbGciOiJIUzI1NiJ9...' })
  @IsNotEmpty()
  @IsString()
  readonly refreshToken: string;
}
