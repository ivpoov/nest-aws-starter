export interface AuthTokensResponseInterface {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresInSec: number;
}
