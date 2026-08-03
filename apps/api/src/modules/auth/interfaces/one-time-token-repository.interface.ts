import type { OneTimeTokenKindEnum } from '@modules/auth/enums/one-time-token-kind.enum.js';

export interface OneTimeTokenRepositoryInterface {
  setToken(
    userId: string,
    kind: OneTimeTokenKindEnum,
    token: string,
    ttlSec: number,
  ): Promise<void>;
  consumeToken(userId: string, kind: OneTimeTokenKindEnum): Promise<string | null>;
}
