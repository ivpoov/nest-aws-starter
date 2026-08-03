export interface TokenPairInterface {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSec: number;
}
