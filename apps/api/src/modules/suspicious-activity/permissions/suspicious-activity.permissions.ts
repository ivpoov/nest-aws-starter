import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { LockoutEntity } from '@modules/suspicious-activity/entities/lockout.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const suspiciousActivityPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, LockoutEntity);
    can(ActionsEnum.DELETE, LockoutEntity);
  },
};
