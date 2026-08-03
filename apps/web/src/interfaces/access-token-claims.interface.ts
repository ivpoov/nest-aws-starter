import type { UserRoleEnum } from '@nest-aws-starter/shared';

// Display-only shape of the access token's JWT payload — decoded client-side
// without signature verification, purely to drive UI (the impersonation
// banner). The API is the only party that ever trusts these claims.
export interface AccessTokenClaimsInterface {
  readonly sessionId: string;
  readonly role: UserRoleEnum;
  readonly actAsBy?: string;
  readonly exp?: number;
}
