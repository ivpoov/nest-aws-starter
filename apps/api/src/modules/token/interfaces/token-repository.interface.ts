import type { RotateTokensDataInterface } from '@modules/token/interfaces/rotate-tokens-data.interface.js';
import type { RotationStateInterface } from '@modules/token/interfaces/rotation-state.interface.js';

// The allowlist stores digests, never tokens: callers hand a token in and ask
// whether it matches, and no method hands a stored token back out. The one
// exception is the rotation grace entry, which has to replay the pair it
// recorded. See TokenRedisRepository for why.
export interface TokenRepositoryInterface {
  setAccessToken(userId: string, sessionId: string, token: string, ttlSec: number): Promise<void>;
  setRefreshToken(userId: string, sessionId: string, token: string, ttlSec: number): Promise<void>;
  matchesAccessToken(userId: string, sessionId: string, token: string): Promise<boolean>;
  // Both refresh questions — "is this current?" and "is there a grace replay
  // for it?" — answered from one atomic read. Every refresh decision is taken
  // against this single snapshot; asking them separately lets a rotation
  // commit in between and turns an honest second tab into a detected replay.
  readRotationState(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<RotationStateInterface>;
  // Records the pair that replaces the presented token and installs it, in one
  // indivisible step, but only while the presented token is still the current
  // one. Resolves false when another rotation got there first — the caller has
  // lost the swap, not been caught replaying a stolen token.
  rotateTokens(data: RotateTokensDataInterface): Promise<boolean>;
  deleteAllForSession(userId: string, sessionId: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
