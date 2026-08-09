import { OauthIntentEnum } from '@modules/oauth/enums/oauth-intent.enum.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

export class OauthStartQueryDto {
  @ApiProperty({ enum: OauthIntentEnum, example: OauthIntentEnum.LOGIN })
  @IsEnum(OauthIntentEnum)
  readonly intent: OauthIntentEnum;

  // Shape check only — the redirect target is authorized in OauthFlowService,
  // which compares its origin to WEB_APP_BASE_URL exactly. `require_tld: false`
  // is required or `http://localhost:5173` (the default web app URL, and every
  // developer's) fails validation before that comparison ever runs.
  @ApiProperty({ type: String, example: 'http://localhost:5173/auth/callback' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, require_tld: false, protocols: ['http', 'https'] })
  readonly redirect: string;
}
