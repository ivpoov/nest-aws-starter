import { OauthIntentEnum } from '@modules/oauth/enums/oauth-intent.enum.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class OauthStartQueryDto {
  @ApiProperty({ enum: OauthIntentEnum, example: OauthIntentEnum.LOGIN })
  @IsEnum(OauthIntentEnum)
  readonly intent: OauthIntentEnum;

  @ApiProperty({ type: String, example: 'http://localhost:5173/auth/callback' })
  @IsNotEmpty()
  @IsString()
  readonly redirect: string;
}
