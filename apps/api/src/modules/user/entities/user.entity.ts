import type { UserInterface } from '@modules/user/interfaces/user.interface.js';
import type { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';

// CASL subject class — the ability metadata target for user administration.
export class UserEntity implements UserInterface {
  declare readonly id: string;
  declare readonly displayName: string;
  declare readonly role: UserRoleEnum;
  declare readonly status: UserStatusEnum;
  declare readonly avatarKey: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}
