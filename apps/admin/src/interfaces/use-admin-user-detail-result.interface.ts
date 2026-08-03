import type {
  AdminUserResponseInterface,
  ApiErrorInterface,
  SessionResponseInterface,
} from '@nest-aws-starter/shared';

export interface UseAdminUserDetailResultInterface {
  readonly user: AdminUserResponseInterface | null;
  readonly sessions: SessionResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly forceLogout: () => Promise<void>;
}
