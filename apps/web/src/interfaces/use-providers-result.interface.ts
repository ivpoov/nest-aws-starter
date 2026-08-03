import type { AuthMethodTypeEnum } from '@nest-aws-starter/shared';

export interface UseProvidersResultInterface {
  readonly providers: AuthMethodTypeEnum[];
  readonly isLoading: boolean;
}
