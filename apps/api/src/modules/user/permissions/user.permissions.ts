import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { UserEntity } from '@modules/user/entities/user.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const userPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, UserEntity);
  },
};
