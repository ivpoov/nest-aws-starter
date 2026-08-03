import type { AdminUserResponseInterface } from './admin-user-response.interface.js';

export interface AdminUserListResponseInterface {
  readonly items: AdminUserResponseInterface[];
  readonly nextCursor: string | null;
}
