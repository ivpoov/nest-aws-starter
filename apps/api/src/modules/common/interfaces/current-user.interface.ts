import { UserRoleEnum } from '@nest-aws-starter/shared';

export interface CurrentUserInterface {
  readonly id: string;
  readonly role: UserRoleEnum;
  readonly sessionId: string;
}
