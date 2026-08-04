import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { StatisticEntity } from '@modules/statistic/entities/statistic.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const statisticPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, StatisticEntity);
  },
};
