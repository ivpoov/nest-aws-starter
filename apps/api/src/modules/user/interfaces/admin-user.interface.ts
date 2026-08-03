import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface AdminUserInterface extends UserInterface {
  readonly email: string | null;
  readonly methodTypes: AuthMethodTypeEnum[];
}
