import { ActivityEntity } from '@modules/activity/entities/activity.entity.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const activityPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, ActivityEntity);
  },
};
