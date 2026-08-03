import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';
import { AuthMethodTypeEnum, OauthExchangeKindEnum } from '@nest-aws-starter/shared';

export interface OauthExchangePayloadInterface {
  readonly kind: OauthExchangeKindEnum;
  readonly tokens: TokenPairInterface | null;
  readonly linkedProvider: AuthMethodTypeEnum | null;
}
