import type { UserRoleEnum } from '@nest-aws-starter/shared';

export interface UseAdminGateResultInterface {
  readonly isAuthenticated: boolean;
  readonly isResolving: boolean;
  readonly role: UserRoleEnum | null;
}
