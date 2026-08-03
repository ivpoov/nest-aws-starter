import type { AuthMethodTypeEnum } from '../enums/auth-method-type.enum.js';
import type { UserRoleEnum } from '../enums/user-role.enum.js';
import type { UserStatusEnum } from '../enums/user-status.enum.js';

export interface AdminUserResponseInterface {
  readonly id: string;
  readonly displayName: string;
  readonly role: UserRoleEnum;
  readonly status: UserStatusEnum;
  readonly email: string | null;
  readonly methodTypes: AuthMethodTypeEnum[];
  readonly createdAt: string;
  readonly updatedAt: string;
}
