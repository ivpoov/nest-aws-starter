import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface UserWithMethodTypesInterface extends UserInterface {
  readonly methodTypes: AuthMethodTypeEnum[];
}
