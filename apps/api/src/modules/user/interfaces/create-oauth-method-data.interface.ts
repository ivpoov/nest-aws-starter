import { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface CreateOauthMethodDataInterface {
  readonly type: AuthMethodTypeEnum;
  readonly providerAccountId: string;
  readonly email: string | null;
  readonly isEmailVerified: boolean;
}
