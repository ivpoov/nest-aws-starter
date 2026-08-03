import type { OauthIntentEnum } from '@modules/oauth/enums/oauth-intent.enum.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface OauthStatePayloadInterface {
  readonly provider: AuthMethodTypeEnum;
  readonly intent: OauthIntentEnum;
  readonly userId: string | null;
  readonly redirect: string;
}
