import type { ApiErrorInterface, UserResponseInterface } from '@nest-aws-starter/shared';

export interface UseProfileResultInterface {
  readonly profile: UserResponseInterface | null;
  readonly isLoading: boolean;
  readonly isUploadingAvatar: boolean;
  readonly error: ApiErrorInterface | null;
  readonly rename: (displayName: string) => Promise<void>;
  readonly uploadAvatar: (file: File) => Promise<void>;
}
