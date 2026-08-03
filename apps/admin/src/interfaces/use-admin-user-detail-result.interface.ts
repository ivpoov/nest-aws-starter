import type {
  AdminUserResponseInterface,
  ApiErrorInterface,
  SessionResponseInterface,
  UserStatusEnum,
} from '@nest-aws-starter/shared';

export interface UseAdminUserDetailResultInterface {
  readonly user: AdminUserResponseInterface | null;
  readonly sessions: SessionResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly forceLogout: () => Promise<void>;
  readonly updateStatus: (status: UserStatusEnum, reason?: string) => Promise<void>;
  readonly isUpdatingStatus: boolean;
  readonly loginAs: () => Promise<void>;
  readonly isLoggingIn: boolean;
}
