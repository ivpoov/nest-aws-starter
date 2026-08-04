import type { SessionInterface } from '@modules/session/interfaces/session.interface.js';
import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';

export interface CreateSessionResultInterface {
  readonly session: SessionInterface;
  readonly tokens: TokenPairInterface;
}
