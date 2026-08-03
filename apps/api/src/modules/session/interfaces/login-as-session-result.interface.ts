import type { TokenPairInterface } from '@modules/token/interfaces/token-pair.interface.js';

export interface LoginAsSessionResultInterface {
  readonly tokens: TokenPairInterface;
  readonly sessionId: string;
}
