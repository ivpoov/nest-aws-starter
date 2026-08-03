import { UserRoleEnum } from '@nest-aws-starter/shared';

export interface IssuePairDataInterface {
  readonly userId: string;
  readonly role: UserRoleEnum;
  readonly sessionId: string;
  readonly actAsBy?: string | null | undefined;
  // Overrides AuthConfig.refreshTtlSec for both the refresh JWT's exp claim
  // and its Redis allowlist key — impersonated sessions cap this at
  // IMPERSONATION_ACTIVE_TTL_SEC so the refresh token can never outlive the
  // session's advertised activeUntil.
  readonly refreshTtlSec?: number | undefined;
}
