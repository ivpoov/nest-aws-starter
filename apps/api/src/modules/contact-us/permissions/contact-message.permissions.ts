import { ActionsEnum } from '@modules/casl/enums/actions.enum.js';
import type { PermissionContextInterface } from '@modules/casl/interfaces/permission-context.interface.js';
import type { PermissionsType } from '@modules/casl/types/permissions.type.js';
import { ContactMessageEntity } from '@modules/contact-us/entities/contact-message.entity.js';
import { UserRoleEnum } from '@nest-aws-starter/shared';

// Public submission (POST /contact) is unauthenticated and bypasses CASL
// entirely via @Public() — this only governs the /admin/contact-messages
// read + status-update endpoints.
export const contactMessagePermissions: PermissionsType = {
  [UserRoleEnum.ADMIN]: ({ can }: PermissionContextInterface): void => {
    can(ActionsEnum.READ, ContactMessageEntity);
    can(ActionsEnum.UPDATE, ContactMessageEntity);
  },
};
