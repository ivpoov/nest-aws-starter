import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { NoteEntity } from '@modules/note/entities/note.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

export const notePermissions: PermissionsType = {
  [UserRoleEnum.USER]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, NoteEntity);
  },
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.MANAGE, NoteEntity);
  },
};
