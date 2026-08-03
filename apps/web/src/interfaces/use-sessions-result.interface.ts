import type { ApiErrorInterface, SessionResponseInterface } from '@nest-aws-starter/shared';

export interface UseSessionsResultInterface {
  readonly sessions: SessionResponseInterface[];
  readonly isLoading: boolean;
  readonly error: ApiErrorInterface | null;
  readonly revoke: (id: string) => Promise<void>;
  readonly revokeOthers: () => Promise<void>;
}
