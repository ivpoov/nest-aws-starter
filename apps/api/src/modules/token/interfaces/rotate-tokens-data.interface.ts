// Everything one atomic rotation needs: the token the caller presented (the
// compare half of the compare-and-swap) plus the pair that replaces it. Tokens
// go in verbatim and the repository digests them — no caller ever computes a
// digest, so the storage format stays the repository's business.
export interface RotateTokensDataInterface {
  readonly userId: string;
  readonly sessionId: string;
  // The swap only happens while this is still the stored refresh token.
  readonly expectedRefreshToken: string;
  readonly accessToken: string;
  readonly accessTtlSec: number;
  readonly refreshToken: string;
  readonly refreshTtlSec: number;
  // TTL of the grace entry recording the pair that replaced the presented
  // token, so a concurrent refresher can be handed the same answer.
  readonly graceTtlSec: number;
}
