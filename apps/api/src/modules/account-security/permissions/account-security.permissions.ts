import { LockoutEntity } from '@modules/account-security/entities/lockout.entity.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const accountSecurityPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, LockoutEntity);
    can(ActionsEnum.DELETE, LockoutEntity);
  },
};
