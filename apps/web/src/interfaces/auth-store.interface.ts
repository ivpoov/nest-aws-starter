import type { UserResponseInterface } from '@nest-aws-starter/shared';

export interface AuthStoreInterface {
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly user: UserResponseInterface | null;
  readonly setTokens: (accessToken: string, refreshToken: string) => void;
  readonly setUser: (user: UserResponseInterface | null) => void;
  readonly clear: () => void;
}
