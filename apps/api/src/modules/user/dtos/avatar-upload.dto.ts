import type { AvatarUploadRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AvatarUploadDto implements AvatarUploadRequestInterface {
  @ApiProperty({ type: String, example: 'image/png' })
  @IsString()
  @MaxLength(100)
  readonly contentType: string;
}
