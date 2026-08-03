import type { UserStatusEnum } from '../enums/user-status.enum.js';

export interface UpdateUserStatusRequestInterface {
  readonly status: UserStatusEnum;
}
