import type { AuthMethodTypeEnum } from '../../users/enums/auth-method-type.enum.js';

export interface AuthMethodResponseInterface {
  readonly type: AuthMethodTypeEnum;
  readonly email: string | null;
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
}
