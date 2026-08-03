import type { AuthMethodTypeEnum } from '../../users/enums/auth-method-type.enum.js';

export interface OauthProvidersResponseInterface {
  readonly providers: AuthMethodTypeEnum[];
}
