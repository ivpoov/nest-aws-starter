import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { PlanEntity } from '@modules/payment/entities/plan.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const planPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, PlanEntity);
  },
};
