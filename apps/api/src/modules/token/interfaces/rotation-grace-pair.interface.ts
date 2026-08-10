// The token pair that replaced a refresh token, held for the rotation grace
// window so a concurrent refresh presenting the replaced token gets the same
// answer as the request that won the race instead of tripping the reuse
// tripwire. Deliberately not a TokenPairInterface: expiresInSec is derived
// from config by the caller and has no business being stored.
export interface RotationGracePairInterface {
  readonly accessToken: string;
  readonly refreshToken: string;
}
