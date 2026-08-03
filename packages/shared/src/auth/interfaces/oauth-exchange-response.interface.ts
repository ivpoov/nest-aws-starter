import type { AuthMethodTypeEnum } from '../../users/enums/auth-method-type.enum.js';
import type { OauthExchangeKindEnum } from '../enums/oauth-exchange-kind.enum.js';
import type { AuthTokensResponseInterface } from './auth-tokens-response.interface.js';

export interface OauthExchangeResponseInterface {
  readonly kind: OauthExchangeKindEnum;
  readonly tokens: AuthTokensResponseInterface | null;
  readonly linkedProvider: AuthMethodTypeEnum | null;
}
