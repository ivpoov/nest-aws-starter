import type { UserRoleEnum } from '../enums/user-role.enum.js';
import type { UserStatusEnum } from '../enums/user-status.enum.js';

export interface UserResponseInterface {
  readonly id: string;
  readonly displayName: string;
  readonly role: UserRoleEnum;
  readonly status: UserStatusEnum;
  readonly avatarUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
