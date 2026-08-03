import { UserRoleEnum, UserStatusEnum } from '@nest-aws-starter/shared';

export interface UserInterface {
  readonly id: string;
  readonly displayName: string;
  readonly role: UserRoleEnum;
  readonly status: UserStatusEnum;
  readonly avatarKey: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
