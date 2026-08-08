import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { NotificationEntity } from '@modules/notification/entities/notification.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

// Same READ+UPDATE grant for both roles — the class-level gate is
// identical; per-row ownership (own USER rows vs. any ADMIN row) is
// resolved in NotificationService against the caller's id and role.
export const notificationPermissions: PermissionsType = {
  [UserRoleEnum.USER]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, NotificationEntity);
    can(ActionsEnum.UPDATE, NotificationEntity);
  },
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, NotificationEntity);
    can(ActionsEnum.UPDATE, NotificationEntity);
  },
};
