import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { UserRoleEnum } from '@nest-aws-starter/shared';

export type PermissionsType = Partial<
  Record<UserRoleEnum, (context: PermissionContextInterface) => void>
>;
