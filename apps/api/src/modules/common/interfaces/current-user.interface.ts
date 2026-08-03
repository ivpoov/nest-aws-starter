import { UserRoleEnum } from '@nest-aws-starter/shared';

export interface CurrentUserInterface {
  readonly id: string;
  readonly role: UserRoleEnum;
  readonly sessionId: string;
  // Admin user id when this request is running through an admin login-as
  // session — the web app shows an "impersonated" banner from this claim.
  readonly actAsBy?: string | undefined;
}
