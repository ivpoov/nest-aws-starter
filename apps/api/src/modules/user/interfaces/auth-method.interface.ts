import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface AuthMethodInterface {
  readonly id: string;
  readonly userId: string;
  readonly type: AuthMethodTypeEnum;
  readonly email: string | null;
  readonly isEmailVerified: boolean;
  readonly passwordHash: string | null;
  readonly providerAccountId: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
}
