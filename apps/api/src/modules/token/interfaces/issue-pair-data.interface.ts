import { UserRoleEnum } from '@nest-aws-starter/shared';

export interface IssuePairDataInterface {
  readonly userId: string;
  readonly role: UserRoleEnum;
  readonly sessionId: string;
}
