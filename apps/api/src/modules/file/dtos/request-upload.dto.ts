import { FileIntentEnum, type RequestUploadRequestInterface } from '@nest-aws-starter/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class RequestUploadDto implements RequestUploadRequestInterface {
  @ApiProperty({ enum: FileIntentEnum, example: FileIntentEnum.ATTACHMENT })
  @IsEnum(FileIntentEnum)
  readonly intent: FileIntentEnum;

  @ApiProperty({ type: String, example: 'image/png' })
  @IsString()
  @MaxLength(100)
  readonly contentType: string;

  @ApiPropertyOptional({ type: Number, example: 102_400 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  readonly size?: number | undefined;
}
