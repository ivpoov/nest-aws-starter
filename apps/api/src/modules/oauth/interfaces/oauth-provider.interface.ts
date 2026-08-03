import type { OauthProfileInterface } from '@modules/oauth/interfaces/oauth-profile.interface.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface OauthProviderInterface {
  readonly type: AuthMethodTypeEnum;
  buildConsentUrl(state: string): string;
  exchangeCode(code: string): Promise<OauthProfileInterface>;
}
