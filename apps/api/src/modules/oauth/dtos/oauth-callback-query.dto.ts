import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OauthCallbackQueryDto {
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  readonly state: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  readonly code: string;
}
