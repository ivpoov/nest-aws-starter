import { ApiKeyEntity } from '@modules/api-key/entities/api-key.entity.js';
import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

// API keys are an admin-only credential — only admins can create, list, or
// revoke them. The demo route that consumes a key (GET /api-demo/whoami) is
// authenticated by ApiKeyGuard instead, and never touches CASL.
export const apiKeyPermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, ApiKeyEntity);
  },
};
