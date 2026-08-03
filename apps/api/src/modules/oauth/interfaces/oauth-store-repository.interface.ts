import type { OauthExchangePayloadInterface } from '@modules/oauth/interfaces/oauth-exchange-payload.interface.js';
import type { OauthStatePayloadInterface } from '@modules/oauth/interfaces/oauth-state-payload.interface.js';

export interface OauthStoreRepositoryInterface {
  setState(state: string, payload: OauthStatePayloadInterface, ttlSec: number): Promise<void>;
  consumeState(state: string): Promise<OauthStatePayloadInterface | null>;
  setExchange(code: string, payload: OauthExchangePayloadInterface, ttlSec: number): Promise<void>;
  consumeExchange(code: string): Promise<OauthExchangePayloadInterface | null>;
}
