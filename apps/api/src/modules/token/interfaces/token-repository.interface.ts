export interface TokenRepositoryInterface {
  setAccessToken(userId: string, sessionId: string, token: string, ttlSec: number): Promise<void>;
  setRefreshToken(userId: string, sessionId: string, token: string, ttlSec: number): Promise<void>;
  setPreviousRefreshToken(
    userId: string,
    sessionId: string,
    token: string,
    ttlSec: number,
  ): Promise<void>;
  getAccessToken(userId: string, sessionId: string): Promise<string | null>;
  getRefreshToken(userId: string, sessionId: string): Promise<string | null>;
  getPreviousRefreshToken(userId: string, sessionId: string): Promise<string | null>;
  deleteAllForSession(userId: string, sessionId: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
