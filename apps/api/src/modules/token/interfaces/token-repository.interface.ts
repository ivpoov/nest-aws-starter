import type { RotationGracePairInterface } from '@modules/token/interfaces/rotation-grace-pair.interface.js';

// The allowlist stores digests, never tokens: callers hand a token in and ask
// whether it matches, and no method hands a stored token back out. See
// TokenRedisRepository for why.
export interface TokenRepositoryInterface {
  setAccessToken(userId: string, sessionId: string, token: string, ttlSec: number): Promise<void>;
  setRefreshToken(userId: string, sessionId: string, token: string, ttlSec: number): Promise<void>;
  // Opens the rotation grace window: remembers the token being replaced, plus
  // the pair that replaced it, for ttlSec.
  setRotationGrace(
    userId: string,
    sessionId: string,
    replacedToken: string,
    issued: RotationGracePairInterface,
    ttlSec: number,
  ): Promise<void>;
  matchesAccessToken(userId: string, sessionId: string, token: string): Promise<boolean>;
  matchesRefreshToken(userId: string, sessionId: string, token: string): Promise<boolean>;
  // The pair that replaced `token` if it is inside its grace window, else null.
  findRotationGraceReplay(
    userId: string,
    sessionId: string,
    token: string,
  ): Promise<RotationGracePairInterface | null>;
  deleteAllForSession(userId: string, sessionId: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
